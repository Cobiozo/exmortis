import { runSql, escStr } from "./supabase.ts";

// Opinie kupujących — tabela public.product_reviews.
// RLS włączony, bez polityk: dostęp wyłącznie z serwera (Management API / service_role).
// Tabela zakładana idempotentnie przy pierwszym użyciu (wzorzec jak w pozostałych modułach).

export const REVIEW_MIN = 20;
export const REVIEW_MAX = 1000;
export const MAX_PER_HOUR = 10;

let READY = false;
export async function ensureReviewsTable(base44) {
  if (READY) return;
  await runSql(base44, `CREATE TABLE IF NOT EXISTS public.product_reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id text NOT NULL,
    order_id text NOT NULL,
    email text NOT NULL,
    display_name text NOT NULL,
    rating int NOT NULL,
    body text NOT NULL,
    status text NOT NULL DEFAULT 'oczekuje',
    consent_text text,
    consent_at timestamptz,
    reply text,
    created_at timestamptz NOT NULL DEFAULT now(),
    published_at timestamptz
  )`);
  await runSql(base44, `CREATE UNIQUE INDEX IF NOT EXISTS product_reviews_order_product ON public.product_reviews (order_id, product_id)`);
  await runSql(base44, `CREATE INDEX IF NOT EXISTS product_reviews_product ON public.product_reviews (product_id, status, published_at DESC)`);
  await runSql(base44, `ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY`);
  await runSql(base44, `REVOKE ALL ON public.product_reviews FROM anon, authenticated`);
  READY = true;
}

// Czysty tekst: bez znaczników, bez znaków sterujących, z pojedynczymi odstępami.
// Treść i odpowiedź są zawsze tekstem — nigdy HTML.
export function plainText(v, { min = 1, max = 2000, label = "Treść" } = {}) {
  const s = String(v ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length < min) throw new Error(`${label}: min. ${min} znaków`);
  if (s.length > max) throw new Error(`${label}: max. ${max} znaków`);
  return s;
}

// Domyślny podpis: imię + pierwsza litera nazwiska z zamówienia.
export function defaultName(buyerName) {
  const parts = String(buyerName || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0].slice(0, 40);
  return `${parts[0]} ${parts[1][0].toUpperCase()}.`.slice(0, 40);
}

// Zdanie zgody — dokładnie takie, jakie osoba widzi przed wysłaniem opinii.
export const consentText = (name) =>
  `Zgadzam się na publikację mojej opinii z podpisem ${name} na exmortis.pl`;

// Średnia i liczba opublikowanych opinii dla podanych produktów (jedno zapytanie).
export async function ratingMap(base44, ids) {
  const list = [...new Set((ids || []).map(String))].filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 200);
  if (!list.length) return new Map();
  const rows = await runSql(
    base44,
    `SELECT product_id, count(*)::int AS count, round(avg(rating)::numeric, 1)::float8 AS avg
     FROM public.product_reviews
     WHERE status = 'opublikowana' AND product_id IN (${list.map(escStr).join(",")})
     GROUP BY product_id`,
    true
  );
  return new Map((rows || []).map((r) => [String(r.product_id), { count: Number(r.count) || 0, avg: Number(r.avg) || 0 }]));
}