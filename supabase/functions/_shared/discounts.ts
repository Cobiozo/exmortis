import { runSql, escStr } from "./supabase.ts";
// Kody rabatowe: weryfikacja i wyliczenie rabatu (w groszach) po stronie serwera.
// lines: [{ product_id, unit, qty }] — ceny w groszach.
export async function applyDiscount(base44, rawCode, lines) {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) return null;
  const found = (await base44.asServiceRole.entities.DiscountCode.filter({ code, active: true }))[0];
  if (!found) throw new Error("Nieprawidłowy kod rabatowy");
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
  if (found.valid_until && found.valid_until < today) throw new Error("Kod rabatowy wygasł");
  if (found.max_uses && (found.uses || 0) >= found.max_uses) throw new Error("Kod rabatowy został już wykorzystany");
  const ids = found.product_ids || [];
  // Karty podarunkowe nie wchodzą do podstawy żadnego rabatu: kodem z karty nie opłaca się innej karty,
  // a zwykły kod nie obniża ceny karty (karta ma wartość równą zapłaconej kwocie).
  const pids = [...new Set(lines.map((l) => String(l.product_id)))];
  const rows = pids.length ? await runSql(base44, `SELECT id::text AS id FROM public.products WHERE product_type = 'karta' AND id::text IN (${pids.map(escStr).join(",")})`, true) : [];
  const cards = rows.map((r) => r.id);
  const fromCard = String(found.opis || "").startsWith("Karta podarunkowa");
  const base = lines
    .filter((l) => !cards.includes(String(l.product_id)))
    .filter((l) => ids.length === 0 || ids.includes(String(l.product_id)))
    .reduce((s, l) => s + l.unit * l.qty, 0);
  const onlyCards = lines.length > 0 && lines.every((l) => cards.includes(String(l.product_id)));
  if (base === 0) throw new Error(onlyCards ? (fromCard ? "Kodem z karty podarunkowej nie opłacisz innej karty podarunkowej" : "Kodów rabatowych nie łączy się z kartą podarunkową") : "Kod nie obejmuje produktów w koszyku");
  const off = found.kind === "kwota"
    ? Math.min(base, Math.round(found.value * 100))
    : Math.round((base * Math.min(100, found.value)) / 100);
  return { record: found, code, discount: off };
}
// ---- Rezerwacja kodu z limitem użyć (np. karta podarunkowa) już przy składaniu zamówienia ----
// Licznik „uses” rośnie dopiero po opłaceniu, więc dwa równoległe zamówienia z tym samym kodem jednorazowym
// mogłyby przejść oba. Rezerwacja jest atomowa (blokada w bazie) i ważna 30 minut; ta sama osoba (e-mail)
// może ponowić płatność bez czekania. Po opłaceniu rezerwacja jest oznaczana jako użyta (wtedy liczy się „uses”).
const RESERVE_SQL = `
CREATE TABLE IF NOT EXISTS public.discount_reservations (
  order_id text PRIMARY KEY, code text NOT NULL, email text, used boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS discount_reservations_code_idx ON public.discount_reservations (code);
ALTER TABLE public.discount_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.discount_reservations FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.exm_reserve_code(p_code text, p_order text, p_email text, p_free int) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $f$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('kod:' || p_code));
  DELETE FROM public.discount_reservations WHERE NOT used AND created_at < now() - interval '1 day';
  IF (SELECT count(*) FROM public.discount_reservations WHERE code = p_code AND NOT used AND created_at > now() - interval '30 minutes'
        AND order_id <> p_order AND lower(COALESCE(email, '')) <> lower(COALESCE(p_email, ''))) >= p_free THEN
    RETURN false;
  END IF;
  INSERT INTO public.discount_reservations (order_id, code, email) VALUES (p_order, p_code, lower(p_email)) ON CONFLICT (order_id) DO NOTHING;
  RETURN true;
END $f$;
REVOKE EXECUTE ON FUNCTION public.exm_reserve_code(text, text, text, int) FROM PUBLIC, anon, authenticated;`;
let reserveReady = false;
export async function reserveCode(base44, record, orderId, email) {
  const max = Number(record?.max_uses) || 0;
  if (!max) return false; // kod bez limitu użyć — nie ma czego rezerwować
  if (!reserveReady) { await runSql(base44, RESERVE_SQL); reserveReady = true; }
  const free = max - (Number(record.uses) || 0);
  const [r] = await runSql(base44, `SELECT public.exm_reserve_code(${escStr(String(record.code).toUpperCase())}, ${escStr(orderId)}, ${escStr(email || "")}, ${free}) AS ok`);
  if (!r?.ok) throw new Error("Kod rabatowy został już wykorzystany");
  return true;
}
export async function releaseCode(base44, orderId) {
  await runSql(base44, `DELETE FROM public.discount_reservations WHERE order_id = ${escStr(orderId)} AND NOT used`).catch(() => {});
}
export async function markCodeUsed(base44, orderId) {
  await runSql(base44, `DO $m$ BEGIN IF to_regclass('public.discount_reservations') IS NOT NULL THEN
    UPDATE public.discount_reservations SET used = TRUE WHERE order_id = ${escStr(orderId)}; END IF; END $m$`).catch(() => {});
}
