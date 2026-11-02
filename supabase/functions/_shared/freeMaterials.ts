import { runSql } from "./supabase.ts";

// Darmowe materiały — wyłącznie agregaty, bez adresów e-mail w odpowiedzi.
// Zamówienia darmowe: public.orders (total = 0); pozycje siedzą w kolumnie items (jsonb, w praktyce tylko nazwa),
// bywają zapisane w cudzysłowie — dlatego dopasowanie do produktu idzie po nazwie bez znaków specjalnych.
// Dziennik PDF: public.exm_securitylog (typ "pdf", wpis „darmowy: <nazwa>”) — ten sam, który widać
// w Bezpieczeństwo → „Pobrania PDF”. Liczymy wpisy, IP nie czytamy.
export const FREE_STATS_SQL = `WITH ord AS (
  SELECT o.id, lower(trim(COALESCE(o.buyer_email, ''))) AS email, o.created_date,
         (o.newsletter_consent_date IS NOT NULL) AS news,
         regexp_replace(lower(COALESCE(it->>'name', '')), '[^a-z0-9]+', '', 'g') AS k
  FROM public.orders o
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(o.items) = 'array' THEN o.items ELSE '[]'::jsonb END) it
  WHERE COALESCE(o.total, 0) = 0
), prod AS (
  SELECT p.name, COALESCE(p.product_type, '') AS product_type, COALESCE(p.slug, '') AS slug,
         (COALESCE(p.is_free, false) OR COALESCE(p.price, 0) = 0) AS darmowy,
         regexp_replace(lower(COALESCE(p.name, '')), '[^a-z0-9]+', '', 'g') AS k
  FROM public.products p
), agg AS (
  SELECT pr.name, pr.product_type, pr.slug, pr.darmowy,
         COUNT(ord.id)::int AS total,
         COUNT(ord.id) FILTER (WHERE ord.created_date > now() - interval '7 days')::int AS d7,
         COUNT(ord.id) FILTER (WHERE ord.created_date > now() - interval '30 days')::int AS d30,
         COUNT(ord.id) FILTER (WHERE ord.created_date > now() - interval '90 days')::int AS d90,
         COUNT(DISTINCT ord.email) FILTER (WHERE ord.email <> '')::int AS emails,
         COUNT(DISTINCT ord.email) FILTER (WHERE ord.email <> '' AND ord.news)::int AS emails_news,
         MAX(ord.created_date) AS last_at
  FROM prod pr LEFT JOIN ord ON ord.k = pr.k AND pr.k <> ''
  GROUP BY pr.name, pr.product_type, pr.slug, pr.darmowy
)
SELECT a.name, a.product_type, a.slug, a.total, a.d7, a.d30, a.d90, a.emails, a.emails_news, a.last_at,
       (SELECT COUNT(*)::int FROM public.exm_securitylog s
         WHERE s.data->>'type' = 'pdf' AND s.data->>'details' = 'darmowy: ' || a.name) AS pdf_log
FROM agg a
WHERE a.darmowy = TRUE AND (a.total > 0 OR a.product_type IN ('pdf', 'ebook'))
ORDER BY a.total DESC, a.name`;

// Ciąg dzienny (90 dni — front pokazuje 7/30/90), z dniami bez zamówień jako zera.
export const FREE_SERIES_SQL = `SELECT to_char(d.day, 'YYYY-MM-DD') AS day, COALESCE(x.n, 0)::int AS n
FROM generate_series(date_trunc('day', now()) - interval '89 days', date_trunc('day', now()), interval '1 day') AS d(day)
LEFT JOIN (SELECT date_trunc('day', o.created_date) AS day, COUNT(*)::int AS n
           FROM public.orders o WHERE COALESCE(o.total, 0) = 0 AND o.created_date > now() - interval '90 days'
           GROUP BY 1) x ON x.day = d.day
ORDER BY d.day`;

export async function freeStats(base44) {
  const [rows, series] = await Promise.all([
    runSql(base44, FREE_STATS_SQL, true),
    runSql(base44, FREE_SERIES_SQL, true),
  ]);
  const products = (rows || []).map((r) => ({
    name: r.name,
    slug: r.slug,
    type: r.product_type,
    d7: r.d7,
    d30: r.d30,
    d90: r.d90,
    total: r.total,
    emails: r.emails,
    emails_news: r.emails_news,
    pdf: r.pdf_log,
    last_at: r.last_at,
  }));
  return { products, series: series || [] };
}