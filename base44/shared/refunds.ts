// Zwroty PayU z panelu: wiersz w public.order_refunds, wywołanie Refund API, skutki i mail do klienta.
// Skutki (odbiór dostępu, anulowanie biletów, unieważnienie kart) i mail wykonują się WYŁĄCZNIE po
// przyjęciu zwrotu przez PayU — nieudane wywołanie nie rusza niczego. Powtórzone powiadomienie nie dubluje.
import { runSql, escStr, esc } from "./supabase.ts";
import { getSetting } from "./settings.ts";
import { sendMail } from "./smtp.ts";

const BASE_URLS = { secure: "https://secure.payu.com", sandbox: "https://merch-prod.snd.payu.com" };

// Statusy PayU: przyjęty / w toku / odrzucony. Nieznany traktujemy jak „w toku” — bezpieczniej
// poczekać na powiadomienie niż cofnąć dostęp na podstawie niejasnej odpowiedzi.
const ACCEPTED = ["SUCCESS", "SUCCESSFUL", "FINALIZED", "COMPLETED"];
const FAILED = ["CANCELED", "CANCELLED", "ERROR", "REJECTED", "DECLINED", "FAILED"];
const mapStatus = (s) => {
  const v = String(s || "").toUpperCase();
  if (ACCEPTED.includes(v)) return "przyjety";
  if (FAILED.includes(v)) return "blad";
  return "w_toku";
};

export const REFUND_SCHEMA_SQL = `
    CREATE TABLE IF NOT EXISTS public.order_refunds (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id text NOT NULL,
      amount numeric(10,2) NOT NULL,
      reason text,
      status text NOT NULL DEFAULT 'nowy',
      payu_refund_id text,
      ext_refund_id text,
      revoke_access boolean NOT NULL DEFAULT false,
      cancel_tickets boolean NOT NULL DEFAULT false,
      void_cards boolean NOT NULL DEFAULT false,
      effects_done boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz,
      created_by text
    );
    CREATE UNIQUE INDEX IF NOT EXISTS order_refunds_ext_idx ON public.order_refunds (ext_refund_id);
    CREATE INDEX IF NOT EXISTS order_refunds_order_idx ON public.order_refunds (order_id);
    ALTER TABLE public.order_refunds ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.order_refunds FROM PUBLIC, anon, authenticated;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refunded_total numeric(10,2) DEFAULT 0;`;

let schemaReady = false;
export async function ensureRefundSchema(base44) {
  if (schemaReady) return;
  await runSql(base44, REFUND_SCHEMA_SQL);
  schemaReady = true;
}

let tableKnown = null;
export async function hasRefundsTable(base44) {
  if (tableKnown !== null) return tableKnown;
  const rows = await runSql(
    base44,
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_refunds'`,
    true
  ).catch(() => []);
  tableKnown = Array.isArray(rows) && rows.length > 0;
  return tableKnown;
}

export const shortNo = (id) => String(id || "").slice(0, 8).toUpperCase();
const zl = (n) => `${Number(n || 0).toFixed(2).replace(".", ",")} zł`;

// Ile już zwrócono (bez odrzuconych prób) — od tego odejmujemy limit kolejnego zwrotu.
export async function refundedTotal(base44, orderId) {
  if (!(await hasRefundsTable(base44))) return 0;
  const rows = await runSql(
    base44,
    `SELECT COALESCE(SUM(amount) FILTER (WHERE status <> 'blad'), 0)::float8 AS sum
     FROM public.order_refunds WHERE order_id = ${escStr(orderId)}`,
    true
  ).catch(() => []);
  return Number(rows?.[0]?.sum || 0);
}

export async function listRefunds(base44, orderIds) {
  const ids = (orderIds || []).filter(Boolean);
  if (!ids.length || !(await hasRefundsTable(base44))) return [];
  const rows = await runSql(
    base44,
    `SELECT id, order_id, amount::float8 AS amount, reason, status, payu_refund_id, created_at, created_by
     FROM public.order_refunds WHERE order_id IN (${ids.map(escStr).join(",")}) ORDER BY created_at DESC`,
    true
  ).catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

async function payuToken(payu, base) {
  const res = await fetch(`${base}/pl/standard/user/oauth/authorize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: payu.clientId,
      client_secret: payu.clientSecret,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error("PayU: błąd autoryzacji (sprawdź Client ID / Client Secret)");
  return data.access_token;
}

// Skutki zwrotu — dokładnie te zaznaczone w panelu, zapisane przy wierszu zwrotu.
async function applyEffects(base44, row) {
  const sr = base44.asServiceRole.entities;
  const out = {};
  if (row.revoke_access) {
    const rows = await sr.Access.filter({ order_id: String(row.order_id) }, "-created_date", 500).catch(() => []);
    const live = (Array.isArray(rows) ? rows : rows?.items || []).filter((a) => !a.revoked);
    if (live.length) {
      await sr.Access.bulkUpdate(live.map((a) => ({ id: a.id, revoked: true })));
      out.access = live.length;
    }
  }
  if (row.cancel_tickets) {
    // Wyłącznie zmiana statusu biletów z tego zamówienia (bez dotykania innych wierszy).
    const r = await runSql(
      base44,
      `UPDATE public.event_tickets SET status = 'anulowany'
       WHERE order_id = ${escStr(String(row.order_id))} AND status = 'wazny' RETURNING 1`
    ).catch(() => []);
    if (r.length) out.bilety = r.length;
  }
  if (row.void_cards) {
    const tag = `zamówienie ${shortNo(row.order_id)}`;
    const cards = await sr.DiscountCode.filter({ opis: { $regex: tag } }, "created_date", 500).catch(() => []);
    const unused = (Array.isArray(cards) ? cards : cards?.items || []).filter((c) => c.active !== false && !(Number(c.uses) > 0));
    if (unused.length) {
      await sr.DiscountCode.bulkUpdate(unused.map((c) => ({ id: c.id, active: false })));
      out.karty = unused.length;
    }
  }
  return out;
}

async function syncRefundedTotal(base44, orderId) {
  await runSql(
    base44,
    `UPDATE public.orders SET refunded_total = COALESCE(
       (SELECT SUM(amount) FROM public.order_refunds WHERE order_id = ${escStr(orderId)} AND status = 'przyjety'), 0)
     WHERE id = ${escStr(orderId)}`
  ).catch(() => {});
}

const escHtml = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function refundEmailHtml(buyerName, amount, orderId) {
  return `
  <div style="background:#0A0A0B;padding:32px;font-family:Georgia,serif;color:#E2E2E2;">
    <p style="letter-spacing:4px;color:#C9A24A;font-size:13px;">EXMORTIS</p>
    <h1 style="font-size:26px;letter-spacing:1px;">Zwrot przyjęty</h1>
    <p style="color:#8A8A8C;line-height:1.7;">${escHtml(buyerName || "")}, przyjąłem zwrot za zamówienie <span style="color:#E2E2E2;">${shortNo(orderId)}</span>.</p>
    <p style="color:#C9A24A;font-size:22px;margin:20px 0;">${zl(amount)}</p>
    <p style="color:#8A8A8C;font-size:14px;line-height:1.7;">Pieniądze wrócą na rachunek, z którego zapłacono. Księgowanie zwrotu trwa zwykle 3–5 dni roboczych — termin zależy od Twojego banku.</p>
    <p style="color:#5C5C5E;font-size:12px;letter-spacing:2px;margin-top:24px;">WRACAM Z SIEBIE · UCZĘ WRACAĆ</p>
  </div>`;
}

async function sendRefundMail(base44, row) {
  const rows = await runSql(
    base44,
    `SELECT buyer_email, buyer_name FROM public.orders WHERE id = ${escStr(String(row.order_id))} LIMIT 1`,
    true
  ).catch(() => []);
  const o = rows?.[0];
  if (!o?.buyer_email) return "brak";
  return sendMail(base44, {
    to: o.buyer_email,
    subject: `Zwrot przyjęty — zamówienie ${shortNo(row.order_id)}`,
    html: refundEmailHtml(o.buyer_name, row.amount, row.order_id),
    kind: "zwrot",
    ref: String(row.order_id),
  }).catch(() => "blad");
}

// Wspólne domknięcie zwrotu dla odpowiedzi API i dla powiadomienia: status, skutki (raz), mail (raz).
export async function finishRefund(base44, row, status, payuRefundId) {
  const mapped = mapStatus(status);
  await runSql(
    base44,
    `UPDATE public.order_refunds
     SET status = ${escStr(mapped)}, updated_at = now()${payuRefundId ? `, payu_refund_id = ${escStr(payuRefundId)}` : ""}
     WHERE id = ${escStr(row.id)}`
  );
  if (mapped !== "przyjety") return mapped;
  // Atomowe przejęcie skutków — równoległe/ponowione powiadomienie nic nie dubluje.
  const claimed = await runSql(
    base44,
    `UPDATE public.order_refunds SET effects_done = true WHERE id = ${escStr(row.id)} AND effects_done = false RETURNING *`
  );
  const claim = Array.isArray(claimed) ? claimed[0] : null;
  if (!claim) return mapped;
  await applyEffects(base44, claim);
  await syncRefundedTotal(base44, String(claim.order_id));
  await sendRefundMail(base44, claim);
  return mapped;
}

// Powiadomienie PayU o zwrocie: dopasowanie po payu_refund_id albo extRefundId.
export async function applyRefundFromNotification(base44, refund) {
  if (!(await hasRefundsTable(base44))) return null;
  const payuId = String(refund?.refundId || "");
  const extId = String(refund?.extRefundId || "");
  if (!payuId && !extId) return null;
  const where = [payuId ? `payu_refund_id = ${escStr(payuId)}` : null, extId ? `ext_refund_id = ${escStr(extId)}` : null]
    .filter(Boolean)
    .join(" OR ");
  const rows = await runSql(base44, `SELECT * FROM public.order_refunds WHERE ${where} LIMIT 1`, true);
  const row = rows?.[0];
  if (!row) return null;
  return finishRefund(base44, row, refund.status, payuId);
}

// Zwrot z panelu. amount w złotych. Zwraca { ok } albo { error }.
export async function createRefund(base44, { order, amount, reason, by, opts }) {
  await ensureRefundSchema(base44);

  const paid = Number(order.total || 0);
  const already = await refundedTotal(base44, order.id);
  const left = Math.round((paid - already) * 100) / 100;
  const amt = Math.round(Number(amount) * 100) / 100;
  if (!Number.isFinite(amt) || amt <= 0) return { error: "Kwota zwrotu musi być większa od zera." };
  if (amt > left) return { error: `Za dużo — do zwrotu zostało ${zl(left)}.` };

  const payu = await getSetting(base44, "payu").catch(() => null);
  if (!payu || !payu.posId || !payu.clientId || !payu.clientSecret) return { error: "PAYU_NOT_CONFIGURED" };
  const base = BASE_URLS[payu.env === "sandbox" ? "sandbox" : "secure"];

  const cnt = await runSql(
    base44,
    `SELECT COUNT(*)::int AS n FROM public.order_refunds WHERE order_id = ${escStr(order.id)}`,
    true
  ).catch(() => [{ n: 0 }]);
  const extRefundId = `${order.id}-R${(Number(cnt?.[0]?.n) || 0) + 1}`;

  const ins = await runSql(
    base44,
    `INSERT INTO public.order_refunds
       (order_id, amount, reason, status, ext_refund_id, revoke_access, cancel_tickets, void_cards, created_by)
     VALUES (${escStr(order.id)}, ${esc(amt)}, ${escStr(String(reason || "").slice(0, 1000))}, 'nowy',
             ${escStr(extRefundId)}, ${esc(!!opts?.revoke_access)}, ${esc(!!opts?.cancel_tickets)}, ${esc(!!opts?.void_cards)},
             ${escStr(String(by || ""))})
     ON CONFLICT (ext_refund_id) DO NOTHING
     RETURNING *`
  );
  const row = Array.isArray(ins) ? ins[0] : null;
  // Ten sam numer zwrotu już istnieje — nie wołamy PayU drugi raz.
  if (!row) return { error: "Ten zwrot już został zarejestrowany — odśwież listę." };

  let data = {};
  try {
    const token = await payuToken(payu, base);
    const res = await fetch(`${base}/api/v2_1/orders/${encodeURIComponent(String(order.payu_order_id))}/refunds`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        refund: {
          description: String(reason || "Zwrot").slice(0, 100),
          amount: String(Math.round(amt * 100)),
          extRefundId,
        },
      }),
    });
    data = await res.json().catch(() => ({}));
    const refund = data.refund || {};
    if (!res.ok || (!refund.refundId && !refund.status)) {
      const msg = data?.status?.statusDesc || data?.error?.message || "PayU: nie udało się zlecić zwrotu";
      await runSql(base44, `UPDATE public.order_refunds SET status = 'blad', updated_at = now() WHERE id = ${escStr(row.id)}`);
      return { error: msg };
    }
    const status = await finishRefund(base44, row, refund.status, refund.refundId);
    return { ok: true, status, refundId: refund.refundId || null, amount: amt };
  } catch (e) {
    await runSql(base44, `UPDATE public.order_refunds SET status = 'blad', updated_at = now() WHERE id = ${escStr(row.id)}`).catch(() => {});
    return { error: String(e?.message || e) };
  }
}