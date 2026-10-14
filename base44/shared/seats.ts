// Miejsca na produktach z limitem (kohorta, kurs na żywo, warsztat).
// sold — suma sztuk z opłaconych zamówień; pending — z zamówień w trakcie płatności z ostatnich 30 minut.
// Jedno zapytanie dla wszystkich produktów naraz; zwraca wyłącznie produkty z ustawionym limitem.
import { runSql, escStr } from "./supabase.ts";

const PENDING_MIN = 30;

export async function productSeats(base44, ids) {
  const list = [...new Set((ids || []).map((x) => String(x || "")).filter((x) => /^[0-9a-f-]{36}$/i.test(x)))];
  if (!list.length) return new Map();
  const inList = list.map(escStr).join(",");
  const items = `jsonb_array_elements(CASE WHEN jsonb_typeof(o.items) = 'array' THEN o.items ELSE '[]'::jsonb END)`;
  const rows = await runSql(
    base44,
    // capacity czytane przez to_jsonb — działa także, zanim kolumna powstała (jak invoice w zamówieniach).
    `SELECT p.id::text AS id, to_jsonb(p)->>'capacity' AS capacity,
        COALESCE(s.n, 0)::int AS sold,
        COALESCE(q.n, 0)::int AS pending
     FROM public.products p
     LEFT JOIN (
       SELECT i->>'product_id' AS pid, SUM(COALESCE((i->>'quantity')::int, 1))::int AS n
       FROM public.orders o, ${items} i
       WHERE o.status = 'COMPLETED' AND i->>'product_id' IN (${inList})
         -- Zamówienie zwrócone w całości nie zajmuje miejsca (częściowy zwrot zostaje — nie sprzedajemy nadkompletu).
         AND COALESCE((to_jsonb(o)->>'refunded_total')::numeric, 0) < COALESCE(o.total, 0)
       GROUP BY 1
     ) s ON s.pid = p.id::text
     LEFT JOIN (
       SELECT i->>'product_id' AS pid, SUM(COALESCE((i->>'quantity')::int, 1))::int AS n
       FROM public.orders o, ${items} i
       WHERE o.status IN ('NEW', 'PENDING', 'WAITING_FOR_CONFIRMATION')
         AND COALESCE(o.updated_date, o.created_date) > now() - interval '${PENDING_MIN} minutes'
         AND i->>'product_id' IN (${inList})
       GROUP BY 1
     ) q ON q.pid = p.id::text
     WHERE p.id::text IN (${inList}) AND to_jsonb(p)->>'capacity' IS NOT NULL`,
    true
  );
  const out = new Map();
  for (const r of rows || []) {
    const capacity = Number(r.capacity) || 0;
    const sold = Number(r.sold) || 0;
    const pending = Number(r.pending) || 0;
    out.set(String(r.id), { capacity, sold, pending, left: Math.max(0, capacity - sold - pending) });
  }
  return out;
}