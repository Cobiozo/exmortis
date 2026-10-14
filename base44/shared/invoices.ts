// Fakturownia: automatyczne faktury i korekty (API v3 — /invoices.json).
//
// Zasady:
//  • Bez tokenu (sekret FAKTUROWNIA_API_TOKEN) albo przy wyłączonym ustawieniu nie wysyłamy NIC do API
//    i nie zapisujemy błędu — panel pokazuje wtedy tylko ostrzeżenie w karcie Gotowości platformy.
//  • Błąd Fakturowni nigdy nie przerywa zamówienia ani zwrotu — ląduje w invoice_error / correction_error.
//  • Wystawienie jest idempotentne: raz zapisany invoice_id blokuje drugi dokument dla tego zamówienia,
//    a oid_unique w Fakturowni nie pozwala utworzyć dwóch dokumentów o tym samym numerze zamówienia.
import { runSql, escStr } from "./supabase.ts";
import { getSettingsFast } from "./settings.ts";
import { secrets } from "base44:runtime";

// Produkty cyfrowe (e-book, audio, wideo, kurs) mogą mieć własną stawkę VAT.
const CYFROWE = ["pdf", "audio", "wideo", "kurs"];
const STAWKI = ["23", "22", "8", "7", "5", "4", "3", "0", "zw"];

export const FAKTURY_DEFAULT = {
  wlaczona: false,
  subdomena: "",
  dokument_osoba: "vat", // vat | zw | nie
  dokument_firma: "vat", // vat | zw
  stawka: "23",
  stawka_cyfrowe: "", // puste = jak stawka domyślna
  wyslij_email: true,
};

export const DOKUMENT_OSOBA = { vat: "Faktura VAT", zw: "Faktura bez VAT (zwolniona)", nie: "Nie wystawiaj automatycznie" };

// Ustawienia faktur — tolerancyjne przy odczycie, walidujące przy zapisie z panelu.
export function cleanFaktury(v) {
  const s = v && typeof v === "object" ? v : {};
  const sub = String(s.subdomena || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\.fakturownia\.pl.*$/, "")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 40);
  if (sub && !/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(sub)) {
    throw new Error("Nazwa konta w Fakturowni: litery, cyfry i myślniki (np. exmortis — z adresu exmortis.fakturownia.pl)");
  }
  const stawka = (x, fallback) => (STAWKI.includes(String(x)) ? String(x) : fallback);
  return {
    wlaczona: s.wlaczona === true,
    subdomena: sub,
    dokument_osoba: ["vat", "zw", "nie"].includes(s.dokument_osoba) ? s.dokument_osoba : "vat",
    dokument_firma: ["vat", "zw"].includes(s.dokument_firma) ? s.dokument_firma : "vat",
    stawka: stawka(s.stawka, "23"),
    stawka_cyfrowe: s.stawka_cyfrowe ? stawka(s.stawka_cyfrowe, "23") : "",
    wyslij_email: s.wyslij_email !== false,
  };
}

// Token API — wyłącznie z sekretu aplikacji. Nigdy nie trafia do bazy, ustawień ani logów.
export function fakturyToken() {
  try {
    const v = secrets.get("FAKTUROWNIA_API_TOKEN");
    if (v) return String(v).trim();
  } catch {
    /* sekret nieustawiony */
  }
  try {
    const v = (globalThis as any)?.process?.env?.FAKTUROWNIA_API_TOKEN;
    if (v) return String(v).trim();
  } catch {
    /* brak zmiennej środowiskowej */
  }
  return "";
}

export async function loadFaktury(base44) {
  const s = await getSettingsFast(base44, ["faktury"]).catch(() => null);
  let cfg;
  try {
    cfg = cleanFaktury(s?.faktury);
  } catch {
    cfg = { ...FAKTURY_DEFAULT };
  }
  const token = fakturyToken();
  const url = cfg.subdomena ? `https://${cfg.subdomena}.fakturownia.pl` : "";
  return { cfg, token, url, on: !!(cfg.wlaczona && token && url) };
}

// ---- kolumny (zakładane przy pierwszym użyciu, jak invoice/discount_code) ----
const ORDER_COLS = ["invoice_id text", "invoice_number text", "invoice_url text", "invoice_at timestamptz", "invoice_error text"];
const REFUND_COLS = ["correction_id text", "correction_number text", "correction_url text", "correction_error text"];

let COLS_OK = false;
export async function ensureInvoiceColumns(base44) {
  if (COLS_OK) return;
  const add = async (table, cols) => {
    const have = await runSql(
      base44,
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${table}'`,
      true
    ).catch(() => []);
    const names = new Set((Array.isArray(have) ? have : []).map((r) => String(r.column_name)));
    for (const c of cols) {
      const name = c.split(" ")[0];
      if (names.has(name)) continue;
      await runSql(base44, `ALTER TABLE public.${table} ADD COLUMN IF NOT EXISTS ${c}`).catch(() => {});
    }
  };
  await add("orders", ORDER_COLS);
  await add("order_refunds", REFUND_COLS);
  COLS_OK = true;
}

// ---- pomocnicze ----
export const shortNo = (id) => String(id || "").slice(0, 8).toUpperCase();
const zl2 = (n) => Number(n).toFixed(2);
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
const clean = (v, n) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);

// Komunikat błędu bez adresu i tokenu: środowisko wykonawcze dokleja pełny adres żądania
// do błędu fetch, a adres zawiera api_token — nie może trafić do bazy, panelu ani logów.
export const safeErr = (e) =>
  String(e?.message || e)
    .replace(/api_token=[^\s&"'<>]*/gi, "api_token=***")
    .replace(/https?:\/\/[^\s"']*fakturownia\.pl[^\s"']*/gi, "Fakturownia")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);

async function api(url, path, token, { method = "GET", body } = {}) {
  const sep = path.includes("?") ? "&" : "?";
  let res;
  try {
    res = await fetch(`${url}${path}${sep}api_token=${encodeURIComponent(token)}`, {
      method,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: body ? JSON.stringify({ api_token: token, ...body }) : undefined,
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    throw new Error(`Fakturownia: brak połączenia (${String(e?.name || "błąd")})`);
  }
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const raw = data?.error?.message || data?.error || data?.message || text;
    const msg = safeErr(String(raw || "brak odpowiedzi").replace(/<[^>]*>/g, " "));
    throw new Error(`Fakturownia (${res.status}): ${msg}`);
  }
  return data;
}

// Adres firmy z kasy to jedna linia — rozkładamy go na ulicę, kod i miasto (kod w formacie 00-000).
function splitAddress(raw) {
  const s = clean(raw, 200);
  if (!s) return {};
  const m = s.match(/^(.*?)[,\s]\s*(\d{2}-\d{3})[\s,]+(.+)$/);
  if (m) return { buyer_street: clean(m[1], 150), buyer_post_code: m[2], buyer_city: clean(m[3], 100), buyer_country: "PL" };
  const m2 = s.match(/^(.*?)[,\s]\s*(\d{2}-\d{3})$/);
  if (m2) return { buyer_street: clean(m2[1], 150), buyer_post_code: m2[2], buyer_country: "PL" };
  return { buyer_street: s, buyer_country: "PL" };
}

function buyerFields(order, company) {
  const inv = order.invoice && typeof order.invoice === "object" ? order.invoice : {};
  const email = clean(order.buyer_email, 120);
  if (company) {
    const out = { buyer_name: clean(inv.company || order.buyer_name, 150) || "Klient", buyer_email: email };
    const nip = String(inv.nip || "").replace(/[^0-9A-Za-z]/g, "").slice(0, 20);
    if (nip) out.buyer_tax_no = nip;
    return { ...out, ...splitAddress(inv.address) };
  }
  const name = clean(order.buyer_name, 100);
  const [first, ...rest] = name.split(" ");
  const out = { buyer_name: name || email || "Klient", buyer_email: email };
  if (first) out.buyer_first_name = first;
  if (rest.length) out.buyer_last_name = clean(rest.join(" "), 80);
  return out;
}

// Pozycje dokumentu: kwoty w groszach → złote. Karta podarunkowa to bon różnego przeznaczenia:
// nie podlega VAT w chwili zakupu (stawka „np”), dlatego dostaje adnotację „(bon)”.
async function buildPositions(base44, order, cfg, rate) {
  const items = Array.isArray(order.items) ? order.items : [];
  const ids = [...new Set(items.map((i) => String(i?.product_id || "")).filter((id) => id && !id.startsWith("bilet:")))];
  const types = new Map();
  if (ids.length) {
    const rows = await runSql(
      base44,
      `SELECT id::text AS id, product_type FROM public.products WHERE id::text IN (${ids.map(escStr).join(",")})`,
      true
    ).catch(() => []);
    for (const r of Array.isArray(rows) ? rows : []) types.set(String(r.id), String(r.product_type || ""));
  }
  const positions = [];
  let sum = 0;
  for (const it of items) {
    const qty = Math.max(1, Math.min(99, Math.floor(Number(it?.quantity) || 1)));
    const unit = Math.round(Number(it?.unitPrice) || 0);
    const gross = unit * qty;
    if (gross <= 0) continue;
    sum += gross;
    const type = types.get(String(it?.product_id || "")) || "";
    const bon = type === "karta";
    const tax = bon ? "np" : CYFROWE.includes(type) && cfg.stawka_cyfrowe && rate !== "zw" ? cfg.stawka_cyfrowe : rate;
    const name = bon ? `${clean(it?.name, 140) || "Karta podarunkowa"} (bon)` : clean(it?.name, 150) || "Pozycja";
    positions.push({ name, quantity: qty, tax, gross });
  }
  return { positions, sum };
}

// Rabat z kodu rozkładamy na pozycje (proporcjonalnie) — suma dokumentu równa się zapłaconej kwocie,
// a VAT zostaje policzony w tej samej stawce, w jakiej jest dana pozycja.
function applyDiscount(positions, discountGrosze) {
  const total = positions.reduce((s, p) => s + p.gross, 0);
  const cut = Math.min(Math.max(0, Math.round(discountGrosze)), total);
  if (!cut || total <= cut) return positions;
  let left = cut;
  const out = positions.map((p, i) => {
    const share = i === positions.length - 1 ? left : Math.min(left, Math.round((p.gross * cut) / total));
    left -= share;
    return { ...p, gross: p.gross - share };
  });
  return out.filter((p) => p.gross > 0);
}

// ---- wystawienie faktury ----
// Zwraca { ok, number, url } albo { ok:false, skipped | error }. Nie rzuca.
export async function issueInvoice(base44, order) {
  const { cfg, token, url, on } = await loadFaktury(base44);
  if (!cfg.wlaczona) return { ok: false, skipped: "wylaczone" };
  if (!on) return { ok: false, skipped: "brak_konfiguracji" };
  if (!order?.id) return { ok: false, skipped: "brak_zamowienia" };
  await ensureInvoiceColumns(base44);

  const fresh = await runSql(base44, `SELECT * FROM public.orders WHERE id = ${escStr(String(order.id))} LIMIT 1`, true).catch(() => []);
  const o = (Array.isArray(fresh) ? fresh[0] : null) || order;
  if (o.invoice_id) return { ok: true, already: true, number: o.invoice_number || "", url: o.invoice_url || "" };
  const total = Number(o.total || 0);
  if (!(total > 0)) return { ok: false, skipped: "zero" };

  const inv = o.invoice && typeof o.invoice === "object" ? o.invoice : {};
  const company = !!String(inv.nip || "").trim();
  const doc = company ? cfg.dokument_firma : cfg.dokument_osoba;
  if (doc === "nie") return { ok: false, skipped: "osoba_bez_faktury" };

  const rate = doc === "zw" ? "zw" : cfg.stawka;
  const { positions, sum } = await buildPositions(base44, o, cfg, rate);
  if (!positions.length) return { ok: false, skipped: "brak_pozycji" };
  const lines = applyDiscount(positions, sum - Math.round(total * 100));

  const payuId = String(o.payu_order_id || "");
  const day = today();
  const payload = {
    invoice: {
      kind: "vat",
      number: null,
      issue_date: day,
      sell_date: day,
      status: "paid",
      paid: zl2(total),
      payment_type: payuId && !payuId.startsWith("FREE-") ? "payu" : "karta podarunkowa",
      payment_to_kind: "off",
      oid: String(o.id),
      oid_unique: "yes",
      ...buyerFields(o, company),
      positions: lines.map((p) => ({ name: p.name, quantity: p.quantity, tax: p.tax, total_price_gross: zl2(p.gross / 100) })),
    },
  };

  try {
    const created = await api(url, "/invoices.json", token, { method: "POST", body: payload });
    const id = created?.id;
    if (!id) throw new Error("Fakturownia nie zwróciła identyfikatora dokumentu");
    const full = await api(url, `/invoices/${encodeURIComponent(String(id))}.json`, token).catch(() => created);
    const number = clean(full?.number || created?.number || "", 60);
    const pdf = full?.token ? `${url}/invoice/${full.token}.pdf` : `${url}/invoices/${id}`;
    await runSql(
      base44,
      `UPDATE public.orders SET invoice_id = ${escStr(String(id))}, invoice_number = ${escStr(number)},
         invoice_url = ${escStr(pdf)}, invoice_at = now(), invoice_error = NULL
       WHERE id = ${escStr(String(o.id))}`
    );
    // Dokument e-mailem wysyła sama Fakturownia (do adresu z faktury).
    if (cfg.wyslij_email) {
      await api(url, `/invoices/${encodeURIComponent(String(id))}/send_by_email.json?email_pdf=true`, token, { method: "POST", body: {} }).catch(() => {});
    }
    return { ok: true, id: String(id), number, url: pdf };
  } catch (e) {
    const msg = safeErr(e);
    await runSql(
      base44,
      `UPDATE public.orders SET invoice_error = ${escStr(msg)}, invoice_at = now() WHERE id = ${escStr(String(o.id))}`
    ).catch(() => {});
    return { ok: false, error: msg };
  }
}

// ---- korekta do zwrotu ----
// Wystawiana tylko dla zamówień, które mają już fakturę w Fakturowni. Numer korekty zapisujemy przy zwrocie.
export async function issueCorrection(base44, refund) {
  const { cfg, token, url, on } = await loadFaktury(base44);
  if (!cfg.wlaczona || !on) return { ok: false, skipped: "wylaczone" };
  const refundId = String(refund?.id || "");
  const orderId = String(refund?.order_id || "");
  const amount = Math.round(Number(refund?.amount || 0) * 100) / 100;
  if (!refundId || !orderId || !(amount > 0)) return { ok: false, skipped: "brak_danych" };
  await ensureInvoiceColumns(base44);

  const rows = await runSql(base44, `SELECT * FROM public.orders WHERE id = ${escStr(orderId)} LIMIT 1`, true).catch(() => []);
  const o = Array.isArray(rows) ? rows[0] : null;
  if (!o) return { ok: false, skipped: "brak_zamowienia" };
  if (!o.invoice_id) return { ok: false, skipped: "brak_faktury" };
  if (refund.correction_id) return { ok: true, already: true };

  const inv = o.invoice && typeof o.invoice === "object" ? o.invoice : {};
  const doc = String(inv.nip || "").trim() ? cfg.dokument_firma : cfg.dokument_osoba;
  const rate = doc === "zw" ? "zw" : cfg.stawka;
  const total = Number(o.total || 0);
  const name = `Zamówienie ${shortNo(orderId)}`;
  const day = today();

  try {
    const created = await api(url, "/invoices.json", token, {
      method: "POST",
      body: {
        invoice: {
          kind: "correction",
          from_invoice_id: String(o.invoice_id),
          correction_reason: `Zwrot ${zl2(amount)} zł — zamówienie ${shortNo(orderId)}`,
          issue_date: day,
          sell_date: day,
          oid: `${String(o.id)}-K${refundId.slice(0, 8).toUpperCase()}`,
          oid_unique: "yes",
          positions: [
            {
              name: `Korekta — zwrot ${zl2(amount)} zł`,
              quantity: -1,
              tax: rate,
              total_price_gross: zl2(-amount),
              kind: "correction",
              correction_before_attributes: { name, quantity: 1, tax: rate, total_price_gross: zl2(total), kind: "correction_before" },
              correction_after_attributes: { name, quantity: 1, tax: rate, total_price_gross: zl2(total - amount), kind: "correction_after" },
            },
          ],
        },
      },
    });
    const id = created?.id;
    if (!id) throw new Error("Fakturownia nie zwróciła identyfikatora korekty");
    const full = await api(url, `/invoices/${encodeURIComponent(String(id))}.json`, token).catch(() => created);
    const number = clean(full?.number || created?.number || "", 60);
    const pdf = full?.token ? `${url}/invoice/${full.token}.pdf` : `${url}/invoices/${id}`;
    await runSql(
      base44,
      `UPDATE public.order_refunds SET correction_id = ${escStr(String(id))}, correction_number = ${escStr(number)},
         correction_url = ${escStr(pdf)}, correction_error = NULL, updated_at = now() WHERE id = ${escStr(refundId)}`
    );
    if (cfg.wyslij_email) {
      await api(url, `/invoices/${encodeURIComponent(String(id))}/send_by_email.json?email_pdf=true`, token, { method: "POST", body: {} }).catch(() => {});
    }
    return { ok: true, id: String(id), number, url: pdf };
  } catch (e) {
    const msg = safeErr(e);
    await runSql(
      base44,
      `UPDATE public.order_refunds SET correction_error = ${escStr(msg)}, updated_at = now() WHERE id = ${escStr(refundId)}`
    ).catch(() => {});
    return { ok: false, error: msg };
  }
}

// ---- ponowienie (cronTick) ----
// Zamówienia opłacone, bez faktury: 10 minut – 7 dni po opłaceniu, ten sam dokument najwyżej raz na 30 minut.
// Przy ustawieniu „osoba prywatna: nie wystawiaj” bierzemy tylko zamówienia firmowe.
export async function pendingInvoices(base44, cfg, limit = 10) {
  await ensureInvoiceColumns(base44);
  const n = Math.max(1, Math.min(50, Number(limit) || 10));
  const onlyCompany = cfg?.dokument_osoba === "nie";
  const rows = await runSql(
    base44,
    `SELECT * FROM public.orders o
      WHERE o.status = 'COMPLETED' AND COALESCE(o.total, 0) > 0
        AND COALESCE(to_jsonb(o)->>'invoice_id', '') = ''
        AND COALESCE(o.payu_order_id, '') NOT LIKE 'FREE-%'
        AND o.updated_date < now() - interval '10 minutes'
        AND o.updated_date > now() - interval '7 days'
        AND COALESCE((to_jsonb(o)->>'invoice_at')::timestamptz, to_timestamp(0)) < now() - interval '30 minutes'
        ${onlyCompany ? `AND COALESCE(to_jsonb(o)->'invoice'->>'nip', '') <> ''` : ""}
      ORDER BY o.updated_date ASC LIMIT ${n}`,
    true
  ).catch(() => []);
  return Array.isArray(rows) ? rows : [];
}