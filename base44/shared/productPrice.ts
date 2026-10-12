// Cena produktu po stronie serwera — ta sama reguła co src/lib/productPrice.js.
// Promocja (price_start) obowiązuje do końca dnia promo_end_date czasu polskiego.
// Drabinka cen (price_steps: [{ do: "RRRR-MM-DD", cena }]) ma pierwszeństwo: obowiązuje pierwszy próg,
// którego data „do” jeszcze nie minęła; po ostatnim progu — cena regularna.
import { runSql, escStr } from "./supabase.ts";

export const warsawToday = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(new Date());

type Step = { do: string; cena: number };

export function readSteps(p: Record<string, unknown>): Step[] {
  let raw = p?.price_steps as unknown;
  if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { raw = null; } }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => ({ do: String(s?.do || "").slice(0, 10), cena: s?.cena === null || s?.cena === undefined || s?.cena === "" ? NaN : Number(s.cena) }))
    .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.do) && Number.isFinite(s.cena) && s.cena >= 0)
    .sort((a, b) => a.do.localeCompare(b.do));
}

// Bieżący próg i następny (do informacji „od … cena …”). Zwraca null, gdy drabinki nie ma albo się skończyła.
export function activeStep(p: Record<string, unknown>, today = warsawToday()) {
  const steps = readSteps(p);
  const i = steps.findIndex((s) => s.do >= today);
  if (i < 0) return null;
  const regular = p.price_regular != null ? Number(p.price_regular) : Number(p.price);
  const next = steps[i + 1] ? { od: nextDay(steps[i].do), cena: steps[i + 1].cena } : { od: nextDay(steps[i].do), cena: regular };
  return { step: steps[i], next };
}

export function nextDay(d: string): string {
  const t = new Date(`${d}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
}

// Drabinka → te same pola co zwykła promocja (price_start + promo_end_date), żeby cała reszta sklepu działała bez zmian.
export function withSteps<T extends Record<string, unknown>>(p: T): T {
  if (!readSteps(p).length) return p;
  const a = activeStep(p);
  if (!a) return { ...p, price_start: null, promo_end_date: null };
  return { ...p, price_start: a.step.cena, promo_end_date: a.step.do, next_price: a.next };
}

export function unitPrice(p: Record<string, unknown>): number {
  const q = withSteps(p);
  const end = q.promo_end_date ? String(q.promo_end_date).slice(0, 10) : "";
  if (end && q.price_start != null && end >= warsawToday()) return Number(q.price_start);
  return q.price_regular != null ? Number(q.price_regular) : Number(q.price);
}

// ---- Historia cen (Omnibus: najniższa cena z 30 dni przed obniżką) ----
// Jeden wiersz na produkt i dzień (czas polski); przy zmianie w ciągu dnia zostaje niższa cena.
const HISTORY_DDL = `CREATE TABLE IF NOT EXISTS public.product_price_daily (
  product_id text NOT NULL, day date NOT NULL, price numeric(10,2) NOT NULL,
  PRIMARY KEY (product_id, day))`;
let ddlDone = false;
async function ensureHistory(base44) {
  if (ddlDone) return;
  await runSql(base44, HISTORY_DDL);
  await runSql(base44, `ALTER TABLE public.product_price_daily ENABLE ROW LEVEL SECURITY`).catch(() => {});
  ddlDone = true;
}

export const PRICE_COLS = `id, price::float8 AS price, price_regular::float8 AS price_regular, price_start::float8 AS price_start,
  promo_end_date::text AS promo_end_date, to_jsonb(p)->'price_steps' AS price_steps, is_free`;

// Zapis dzisiejszej ceny wszystkich aktywnych, płatnych produktów (wołane z zadania co 5 min i po zapisie w panelu).
let lastRecord = "";
export async function recordPrices(base44, force = false) {
  const stamp = `${warsawToday()}-${new Date().getUTCHours()}`;
  if (!force && lastRecord === stamp) return 0; // najwyżej raz na godzinę na instancję
  await ensureHistory(base44);
  await runSql(base44, `ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_steps jsonb`);
  const rows = await runSql(base44, `SELECT ${PRICE_COLS} FROM public.products p WHERE active = TRUE AND COALESCE(is_free, FALSE) = FALSE AND COALESCE(status, 'dostępny') = 'dostępny'`, true);
  const day = warsawToday();
  const vals = (rows || []).map((r) => ({ id: String(r.id), price: unitPrice(r) })).filter((r) => Number.isFinite(r.price) && r.price > 0);
  if (vals.length) {
    await runSql(base44, `INSERT INTO public.product_price_daily (product_id, day, price) VALUES
      ${vals.map((v) => `(${escStr(v.id)}, ${escStr(day)}::date, ${v.price.toFixed(2)})`).join(",\n      ")}
      ON CONFLICT (product_id, day) DO UPDATE SET price = LEAST(public.product_price_daily.price, EXCLUDED.price)`);
  }
  lastRecord = stamp;
  return vals.length;
}

// Najniższa cena z 30 dni przed początkiem obecnej obniżki — na podstawie zapisanej historii.
// history: [{ day: "RRRR-MM-DD", price }] dla jednego produktu. null = za mało danych (front pokaże cenę regularną).
export function omnibusFrom(history: { day: string; price: number }[], current: number, today = warsawToday()): number | null {
  const past = history.filter((h) => h.day < today).sort((a, b) => b.day.localeCompare(a.day));
  let start = today;
  for (const h of past) { if (Math.abs(Number(h.price) - current) < 0.005) start = h.day; else break; }
  const from = new Date(`${start}T12:00:00Z`); from.setUTCDate(from.getUTCDate() - 30);
  const fromS = from.toISOString().slice(0, 10);
  const window = past.filter((h) => h.day < start && h.day >= fromS).map((h) => Number(h.price));
  return window.length ? Math.min(...window) : null;
}

export async function omnibusPrices(base44, ids: string[]): Promise<Map<string, { day: string; price: number }[]>> {
  const out = new Map();
  if (!ids.length) return out;
  try {
    await ensureHistory(base44);
    const rows = await runSql(base44, `SELECT product_id, day::text AS day, price::float8 AS price FROM public.product_price_daily
      WHERE product_id IN (${ids.map((i) => escStr(String(i))).join(",")}) AND day > (now() AT TIME ZONE 'Europe/Warsaw')::date - 120`, true);
    for (const r of rows || []) { if (!out.has(r.product_id)) out.set(r.product_id, []); out.get(r.product_id).push({ day: r.day, price: Number(r.price) }); }
  } catch { /* bez historii — front pokaże dotychczasową informację */ }
  return out;
}
