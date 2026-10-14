import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, escStr, requireAdmin } from "../../shared/supabase.ts";
import { ensureInvoiceColumn } from "../../shared/orders.ts";

// Panel admina: zamówienia ze Skarbca (lista, podsumowanie, oznaczanie wystawionych faktur).
// Kolumna invoice czytana przez to_jsonb(o) — działa także, zanim powstała.
const LIST_SQL = (where) => `SELECT o.id, o.payu_order_id, o.created_date, o.updated_date, o.buyer_name, o.buyer_email,
    o.note, o.items, o.total::float8 AS total, o.status, to_jsonb(o)->'invoice' AS invoice
  FROM public.orders o WHERE ${where} ORDER BY o.created_date DESC LIMIT 500`;

const SUMMARY_SQL = `SELECT
  COALESCE(SUM(total) FILTER (WHERE status = 'COMPLETED' AND created_date >= date_trunc('month', now() AT TIME ZONE 'Europe/Warsaw') AT TIME ZONE 'Europe/Warsaw'), 0)::float8 AS revenue_month,
  COUNT(*) FILTER (WHERE status = 'COMPLETED' AND created_date >= date_trunc('month', now() AT TIME ZONE 'Europe/Warsaw') AT TIME ZONE 'Europe/Warsaw')::int AS paid_month,
  COALESCE(SUM(total) FILTER (WHERE status = 'COMPLETED'), 0)::float8 AS revenue_all,
  COUNT(*) FILTER (WHERE status IN ('PENDING', 'WAITING_FOR_CONFIRMATION', 'NEW') AND created_date > now() - interval '2 days')::int AS pending,
  COUNT(*) FILTER (WHERE status = 'COMPLETED' AND to_jsonb(o)->'invoice' IS NOT NULL AND jsonb_typeof(to_jsonb(o)->'invoice') = 'object'
    AND COALESCE((to_jsonb(o)->'invoice'->>'wystawiona')::boolean, false) = false)::int AS invoices_todo
  FROM public.orders o WHERE COALESCE(total, 0) > 0`;

// Statystyki sprzedaży za okres (dni) i poprzedni okres tej samej długości. Tylko opłacone zamówienia (COMPLETED).
const STATS_SQL = (days) => `WITH win AS (SELECT now() - interval '${days} days' AS a, now() - interval '${days * 2} days' AS b),
o AS (SELECT o.* FROM public.orders o, win WHERE o.status = 'COMPLETED' AND o.created_date::timestamptz >= win.a),
prev AS (SELECT o.* FROM public.orders o, win WHERE o.status = 'COMPLETED' AND o.created_date::timestamptz >= win.b AND o.created_date::timestamptz < win.a)
SELECT
  (SELECT json_build_object(
    'revenue', COALESCE(SUM(total) FILTER (WHERE total > 0), 0)::float8,
    'orders', COUNT(*) FILTER (WHERE total > 0)::int,
    'buyers', COUNT(DISTINCT lower(buyer_email)) FILTER (WHERE total > 0)::int,
    'downloads', COUNT(*) FILTER (WHERE COALESCE(total, 0) = 0)::int) FROM o) AS cur,
  (SELECT json_build_object(
    'revenue', COALESCE(SUM(total) FILTER (WHERE total > 0), 0)::float8,
    'orders', COUNT(*) FILTER (WHERE total > 0)::int,
    'buyers', COUNT(DISTINCT lower(buyer_email)) FILTER (WHERE total > 0)::int,
    'downloads', COUNT(*) FILTER (WHERE COALESCE(total, 0) = 0)::int) FROM prev) AS prev,
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

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    await requireAdmin(base44);
    const body = await req.json().catch(() => ({}));

    if (body.action === "list") {
      const parts = ["COALESCE(o.total, 0) > 0"];
      const st = String(body.status || "");
      if (st === "paid") parts.push("o.status = 'COMPLETED'");
      else if (st === "pending") parts.push("o.status IN ('PENDING', 'WAITING_FOR_CONFIRMATION', 'NEW')");
      else if (st === "canceled") parts.push("o.status = 'CANCELED'");
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
      return Response.json({ orders, summary: summary[0] || {} });
    }

    if (body.action === "stats") {
      const days = [7, 30, 90, 365].includes(Number(body.days)) ? Number(body.days) : 30;
      const [row] = await runSql(base44, STATS_SQL(days), true);
      return Response.json({ days, ...(row || {}) });
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