import { createClientFromRequest } from "../_shared/compat.ts";
import { runSql, escStr, requireAdmin } from "../_shared/supabase.ts";
import { ensureInvoiceColumn } from "../_shared/orders.ts";
import { resumeFulfillment } from "../_shared/payuQueue.ts";
import { createRefund, listRefunds, hasRefundsTable } from "../_shared/refunds.ts";
import { issueInvoice } from "../_shared/invoices.ts";
import { requireMailDomain } from "../_shared/emailCheck.ts";
import { collectBounces } from "../_shared/bounces.ts";
import { resendLinks } from "../_shared/orderLinks.ts";
import { accessFilter, mirrorRecord } from "../_shared/mirror.ts";

// Panel admina: zamówienia ze Skarbca (lista, podsumowanie, oznaczanie wystawionych faktur).
// Kolumna invoice czytana przez to_jsonb(o) — działa także, zanim powstała.
// refunded_total czytany przez to_jsonb — działa także, zanim powstała kolumna zwrotów.
const LIST_SQL = (where) => `SELECT o.id, o.payu_order_id, o.created_date, o.updated_date, o.buyer_name, o.buyer_email,
    o.note, o.items, o.total::float8 AS total, o.status, to_jsonb(o)->'invoice' AS invoice,
    to_jsonb(o)->>'invoice_number' AS invoice_number, to_jsonb(o)->>'invoice_url' AS invoice_url,
    to_jsonb(o)->>'invoice_error' AS invoice_error,
    to_jsonb(o)->>'payu_status' AS payu_status, to_jsonb(o)->>'fulfilled_at' AS fulfilled_at,
    to_jsonb(o)->>'fulfill_error' AS fulfill_error, to_jsonb(o)->>'fulfill_review' AS fulfill_review,
    COALESCE((to_jsonb(o)->>'is_test')::boolean, false) AS is_test,
    public.exm_test_order(o) AS test,
    COALESCE((to_jsonb(o)->>'refunded_total')::numeric, 0)::float8 AS refunded_total
  FROM public.orders o WHERE ${where} ORDER BY o.created_date DESC LIMIT 500`;

// Przychody i liczby bez zamówień testowych (28.11.2026); faktury do wystawienia — wszystkie (to obowiązek księgowy).
const SUMMARY_SQL = `SELECT
  COALESCE(SUM(total) FILTER (WHERE NOT public.exm_test_order(o) AND status = 'COMPLETED' AND created_date >= date_trunc('month', now() AT TIME ZONE 'Europe/Warsaw') AT TIME ZONE 'Europe/Warsaw'), 0)::float8 AS revenue_month,
  COUNT(*) FILTER (WHERE NOT public.exm_test_order(o) AND status = 'COMPLETED' AND created_date >= date_trunc('month', now() AT TIME ZONE 'Europe/Warsaw') AT TIME ZONE 'Europe/Warsaw')::int AS paid_month,
  COALESCE(SUM(total) FILTER (WHERE NOT public.exm_test_order(o) AND status = 'COMPLETED'), 0)::float8 AS revenue_all,
  COUNT(*) FILTER (WHERE status IN ('PENDING', 'WAITING_FOR_CONFIRMATION', 'NEW') AND created_date > now() - interval '2 days')::int AS pending,
  COUNT(*) FILTER (WHERE status = 'COMPLETED' AND to_jsonb(o)->'invoice' IS NOT NULL AND jsonb_typeof(to_jsonb(o)->'invoice') = 'object'
    AND COALESCE((to_jsonb(o)->'invoice'->>'wystawiona')::boolean, false) = false)::int AS invoices_todo
  FROM public.orders o WHERE COALESCE(total, 0) > 0`;

// Statystyki sprzedaży za okres (dni) i poprzedni okres tej samej długości. Tylko opłacone zamówienia (COMPLETED).
// Zwroty doliczane osobno (tabela order_refunds może jeszcze nie istnieć — wtedy zera).
const STATS_SQL = (days, withRefunds) => `WITH win AS (SELECT now() - interval '${days} days' AS a, now() - interval '${days * 2} days' AS b),
o AS (SELECT o.* FROM public.orders o, win WHERE o.status = 'COMPLETED' AND o.created_date::timestamptz >= win.a AND NOT public.exm_test_order(o)),
prev AS (SELECT o.* FROM public.orders o, win WHERE o.status = 'COMPLETED' AND o.created_date::timestamptz >= win.b AND o.created_date::timestamptz < win.a AND NOT public.exm_test_order(o))
SELECT
  (SELECT json_build_object(
    'revenue', COALESCE(SUM(total) FILTER (WHERE total > 0), 0)::float8,
    'orders', COUNT(*) FILTER (WHERE total > 0)::int,
    'buyers', COUNT(DISTINCT lower(buyer_email)) FILTER (WHERE total > 0)::int,
    'downloads', COUNT(*) FILTER (WHERE COALESCE(total, 0) = 0)::int${withRefunds ? RF_CUR : ""}) FROM o) AS cur,
  (SELECT json_build_object(
    'revenue', COALESCE(SUM(total) FILTER (WHERE total > 0), 0)::float8,
    'orders', COUNT(*) FILTER (WHERE total > 0)::int,
    'buyers', COUNT(DISTINCT lower(buyer_email)) FILTER (WHERE total > 0)::int,
    'downloads', COUNT(*) FILTER (WHERE COALESCE(total, 0) = 0)::int${withRefunds ? RF_PREV : ""}) FROM prev) AS prev,
  (SELECT COALESCE(json_agg(d ORDER BY d.day), '[]'::json) FROM (
    SELECT (created_date::timestamptz AT TIME ZONE 'Europe/Warsaw')::date::text AS day, SUM(total)::float8 AS revenue, COUNT(*)::int AS orders
    FROM o WHERE total > 0 GROUP BY 1) d) AS daily,
  (SELECT COALESCE(json_agg(x ORDER BY x.value DESC, x.units DESC), '[]'::json) FROM (
    SELECT COALESCE(it->>'product_id', it->>'name') AS id, MAX(it->>'name') AS name,
      SUM(COALESCE((it->>'quantity')::int, 1))::int AS units,
      (SUM(COALESCE((it->>'unitPrice')::numeric, 0) * COALESCE((it->>'quantity')::int, 1)) / 100)::float8 AS value,
      COUNT(DISTINCT lower(o.buyer_email))::int AS buyers
    FROM o, jsonb_array_elements(CASE WHEN jsonb_typeof(o.items::jsonb) = 'array' THEN o.items::jsonb ELSE '[]'::jsonb END) it
    GROUP BY 1) x) AS products,
  (SELECT COALESCE(json_agg(c ORDER BY c.uses DESC), '[]'::json) FROM (
    SELECT COALESCE(to_jsonb(o)->>'discount_code', '') AS code, COUNT(*)::int AS uses,
      COALESCE(SUM((SELECT COALESCE(SUM(COALESCE((it->>'unitPrice')::numeric, 0) * COALESCE((it->>'quantity')::int, 1)), 0)
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(o.items::jsonb) = 'array' THEN o.items::jsonb ELSE '[]'::jsonb END) it)
        - COALESCE(o.total, 0) * 100), 0)::float8 / 100 AS discount
    FROM o WHERE COALESCE(to_jsonb(o)->>'discount_code', '') <> '' GROUP BY 1) c) AS codes,
  (SELECT COALESCE(json_agg(w ORDER BY w.total DESC), '[]'::json) FROM (
    SELECT w.product_id::text AS id, MAX(p.name) AS name, COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE to_jsonb(w)->>'notified_at' IS NOT NULL)::int AS notified,
      COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.orders o2, jsonb_array_elements(CASE WHEN jsonb_typeof(o2.items::jsonb) = 'array' THEN o2.items::jsonb ELSE '[]'::jsonb END) it2
        WHERE o2.status = 'COMPLETED' AND lower(o2.buyer_email) = lower(w.email) AND it2->>'product_id' = w.product_id::text))::int AS bought
    FROM public.waitlist w LEFT JOIN public.products p ON p.id::text = w.product_id::text GROUP BY 1) w) AS waitlist`;

// Zwroty w oknie czasu (bieżące i poprzednie) — jedna linia w statystykach sprzedaży.
const RF_CUR = `, 'refunds', (SELECT COALESCE(SUM(r.amount), 0)::float8 FROM public.order_refunds r, win WHERE r.status = 'przyjety' AND r.created_at >= win.a),
    'refunds_n', (SELECT COUNT(*)::int FROM public.order_refunds r, win WHERE r.status = 'przyjety' AND r.created_at >= win.a)`;
const RF_PREV = `, 'refunds', (SELECT COALESCE(SUM(r.amount), 0)::float8 FROM public.order_refunds r, win WHERE r.status = 'przyjety' AND r.created_at >= win.b AND r.created_at < win.a),
    'refunds_n', (SELECT COUNT(*)::int FROM public.order_refunds r, win WHERE r.status = 'przyjety' AND r.created_at >= win.b AND r.created_at < win.a)`;

const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    await requireAdmin(base44);
    const body = await req.json().catch(() => ({}));

    if (body.action === "list") {
      const parts = ["COALESCE(o.total, 0) > 0"];
      // Zamówienia testowe (adresy Dawida, kody TEST…, produkty „test…”) domyślnie ukryte; przełącznik w panelu.
      if (body.include_test !== true) parts.push("NOT public.exm_test_order(o)");
      const st = String(body.status || "");
      if (st === "paid") parts.push("o.status = 'COMPLETED'");
      else if (st === "pending") parts.push("o.status IN ('PENDING', 'WAITING_FOR_CONFIRMATION', 'NEW')");
      else if (st === "canceled") parts.push("o.status = 'CANCELED'");
      else if (st === "failed") parts.push("o.status IN ('CREATING', 'FAILED')");
      else if (st === "unfulfilled") parts.push("o.status = 'COMPLETED'", "to_jsonb(o)->>'fulfilled_at' IS NULL");
      if (body.invoice === "todo") {
        parts.push("o.status = 'COMPLETED'", "jsonb_typeof(to_jsonb(o)->'invoice') = 'object'", "COALESCE((to_jsonb(o)->'invoice'->>'wystawiona')::boolean, false) = false");
      }
      const q = String(body.q || "").trim().slice(0, 100);
      if (q) {
        const like = escStr(`%${q.replace(/[%_\\]/g, "")}%`);
        parts.push(`(o.buyer_email ILIKE ${like} OR o.buyer_name ILIKE ${like} OR o.id ILIKE ${like} OR o.items::text ILIKE ${like})`);
      }
      const [orders, summary] = await Promise.all([
        runSql(base44, LIST_SQL(parts.join(" AND ")), true),
        runSql(base44, SUMMARY_SQL, true),
      ]);
      // Zwroty pokazywane przy zamówieniu (etykieta ZWRÓCONE / CZĘŚCIOWY ZWROT).
      const refunds = await listRefunds(base44, orders.map((o) => o.id));
      return Response.json({ orders, summary: summary[0] || {}, refunds });
    }

    // Darmowe pobrania (zamówienia FREE z formularza darmowego materiału): kto, co, kiedy, zapis na Listy.
    // Wyłącznie dla administratora — dane zbierane i tak, żeby wysłać materiał.
    if (body.action === "free") {
      const parts = ["o.status = 'FREE'"];
      const q = String(body.q || "").trim().slice(0, 100);
      if (q) {
        const like = escStr(`%${q.replace(/[%_\\]/g, "")}%`);
        parts.push(`(o.buyer_email ILIKE ${like} OR o.buyer_name ILIKE ${like} OR o.items::text ILIKE ${like})`);
      }
      const [rows, sum] = await Promise.all([
        runSql(base44, `SELECT o.id, o.created_date, o.buyer_name, o.buyer_email, o.items,
            (o.newsletter_consent_date IS NOT NULL) AS newsletter,
            COALESCE((to_jsonb(o)->>'is_test')::boolean, false) AS is_test
          FROM public.orders o WHERE ${parts.join(" AND ")} ORDER BY o.created_date DESC LIMIT 500`, true),
        runSql(base44, `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE created_date > now() - interval '30 days')::int AS d30,
            COUNT(DISTINCT lower(buyer_email))::int AS people,
            COUNT(*) FILTER (WHERE newsletter_consent_date IS NOT NULL)::int AS newsletter
          FROM public.orders WHERE status = 'FREE'`, true),
      ]);
      return Response.json({ downloads: rows || [], summary: (sum && sum[0]) || {} });
    }

    if (body.action === "stats") {
      const days = [7, 30, 90, 365].includes(Number(body.days)) ? Number(body.days) : 30;
      const [row] = await runSql(base44, STATS_SQL(days, await hasRefundsTable(base44)), true);
      return Response.json({ days, ...(row || {}) });
    }

    // Zwrot PayU z panelu — tylko opłacone zamówienia, które faktycznie przeszły przez PayU.
    if (body.action === "refund") {
      const id = String(body.id || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Brak zamówienia" }, { status: 400 });
      const [o] = await runSql(base44, `SELECT * FROM public.orders WHERE id = ${escStr(id)} LIMIT 1`, true);
      if (!o) return Response.json({ error: "Nie ma takiego zamówienia" }, { status: 400 });
      if (o.status !== "COMPLETED") return Response.json({ error: "Zwrot dotyczy tylko opłaconych zamówień." }, { status: 400 });
      const payuId = String(o.payu_order_id || "");
      if (!payuId || payuId.startsWith("FREE-")) {
        return Response.json({ error: "To zamówienie nie przeszło przez PayU — zwrot rozlicz poza systemem." }, { status: 400 });
      }
      const me = await requireAdmin(base44);
      const r = await createRefund(base44, {
        order: o,
        amount: body.amount,
        reason: body.reason,
        by: me.email,
        opts: body.opts || {},
      });
      if (r.error === "PAYU_NOT_CONFIGURED") return Response.json({ error: "PAYU_NOT_CONFIGURED" }, { status: 400 });
      if (r.error) return Response.json({ error: r.error }, { status: 400 });
      return Response.json(r);
    }

    // Ponowienie wystawienia faktury w Fakturowni (dostęp sprawdzony przez requireAdmin wyżej).
    if (body.action === "invoice_retry") {
      const id = String(body.id || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Brak zamówienia" }, { status: 400 });
      const [o] = await runSql(base44, `SELECT * FROM public.orders WHERE id = ${escStr(id)} LIMIT 1`, true);
      if (!o) return Response.json({ error: "Nie ma takiego zamówienia" }, { status: 400 });
      if (o.status !== "COMPLETED") return Response.json({ error: "Fakturę wystawiamy tylko do opłaconego zamówienia." }, { status: 400 });
      const r = await issueInvoice(base44, o);
      if (r.error) return Response.json({ error: r.error });
      if (r.skipped) {
        const why = r.skipped === "wylaczone"
          ? "Automatyczne faktury są wyłączone w ustawieniach."
          : r.skipped === "brak_konfiguracji"
          ? "Brak tokenu API albo nazwy konta Fakturowni."
          : r.skipped === "osoba_bez_faktury"
          ? "Ustawienie: osobie prywatnej nie wystawiamy faktury automatycznie."
          : "Nie ma czego wystawić (kwota 0 albo brak pozycji).";
        return Response.json({ skipped: r.skipped, error: why });
      }
      return Response.json(r);
    }

    // Ręczne wznowienie realizacji (administrator — sprawdzone wyżej przez requireAdmin). Płatność sprawdzana w API PayU;
    // zamówienia sporne wymagają dodatkowo confirm === true. Błąd sprawdzenia → 400 i brak zmian.
    if (body.action === "resume_fulfillment") {
      const id = String(body.id || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Brak zamówienia" }, { status: 400 });
      try {
        return Response.json(await resumeFulfillment(base44, id, { confirm: body.confirm === true }));
      } catch (e) {
        const m = String(e?.message || e);
        return Response.json({ error: e?.isValidation ? m : "Nie udało się wznowić realizacji." }, { status: e?.isValidation ? 400 : 500 });
      }
    }

    // 25.11.2026: literówka w adresie kupującego — poprawka adresu w zamówieniu, dostępach i linkach,
    // potem nowy link do materiałów na poprawny adres (opłacone zamówienie).
    // Zwroty poczty ze skrzynki (ostatnie dni) — do sprawdzenia, kto nie dostał maila.
    if (body.action === "bounces") {
      const days = Math.min(14, Math.max(1, Number(body.days) || 7));
      return Response.json({ bounces: await collectBounces(base44, days) });
    }

    if (body.action === "fix_email") {
      const id = String(body.id || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Brak zamówienia" }, { status: 400 });
      const email = String(body.email || "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) return Response.json({ error: "Niepoprawny adres e-mail" }, { status: 400 });
      try { await requireMailDomain(email); } catch (e) { return Response.json({ error: String(e?.message || e) }, { status: 400 }); }
      const rows = await runSql(base44, `SELECT id::text AS id, buyer_email, status FROM public.orders WHERE id::text = ${escStr(id)}`, true);
      if (!rows.length) return Response.json({ error: "Nie ma takiego zamówienia" }, { status: 404 });
      const old = String(rows[0].buyer_email || "").toLowerCase();
      if (old === email) return Response.json({ error: "To ten sam adres" }, { status: 400 });
      await runSql(base44, `UPDATE public.orders SET buyer_email = ${escStr(email)} WHERE id::text = ${escStr(id)}`);
      await runSql(base44, `UPDATE public.order_links SET email = ${escStr(email)} WHERE order_id = ${escStr(id)}`).catch(() => {});
      // Dostępy z tego zamówienia (kursy, zestawy, e-booki w koncie) przechodzą na poprawny adres.
      let moved = 0;
      if (old) {
        const E = base44.asServiceRole.entities.Access;
        const list = await accessFilter(base44, { user_email: old }, "-created_date", 200).catch(() => []);
        for (const a of list) {
          const fromOrder = a.order_id === id || (a.history || []).some((h) => h && h.order_id === id);
          if (!fromOrder) continue;
          await E.update(a.id, { user_email: email });
          await mirrorRecord(base44, "Access", a.id).catch(() => {});
          moved++;
        }
      }
      const sent = rows[0].status === "COMPLETED" ? await resendLinks(base44, { orderId: id }).catch((e) => { console.error("fix_email resend:", e?.message); return 0; }) : 0;
      return Response.json({ ok: true, old, email, moved, sent });
    }

    if (body.action === "invoice_issued") {
      const id = String(body.id || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Brak zamówienia" }, { status: 400 });
      await ensureInvoiceColumn(base44);
      const issued = body.issued === true;
      const number = String(body.number || "").trim().slice(0, 60);
      const patch = { wystawiona: issued, numer: issued ? number : "", data: issued ? new Date().toISOString().slice(0, 10) : "" };
      const rows = await runSql(
        base44,
        `UPDATE public.orders SET invoice = COALESCE(invoice, '{}'::jsonb) || ${escStr(JSON.stringify(patch))}::jsonb, updated_date = now()
         WHERE id = ${escStr(id)} AND jsonb_typeof(invoice) = 'object' RETURNING invoice`
      );
      if (!rows.length) return Response.json({ error: "To zamówienie nie ma danych do faktury" }, { status: 400 });
      return Response.json({ invoice: rows[0].invoice });
    }

    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (error) {
    if (error?.message === "FORBIDDEN") return Response.json({ error: "Brak uprawnień" }, { status: 403 });
    console.error(error);
    return Response.json({ error: "Nie udało się wczytać zamówień" }, { status: 500 });
  }
}

// === Supabase Edge (wygenerowane przez docs/tech/migruj.mjs) ===
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const res = await handler(req);
    const h = new Headers(res.headers);
    for (const [k, v] of Object.entries(CORS)) h.set(k, v);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  } catch (e) {
    const msg = String(e?.message || e);
    const status = msg === "FORBIDDEN" ? 403 : e && e.isValidation ? 400 : 500;
    console.error("edge:", msg.slice(0, 300));
    return Response.json({ error: msg.slice(0, 300) }, { status, headers: CORS });
  }
});
