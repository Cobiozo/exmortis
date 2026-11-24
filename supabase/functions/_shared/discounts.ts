import { runSql, escStr } from "./supabase.ts";
// Błąd dla klienta (400, komunikat widoczny w kasie) — nie generyczny błąd serwera.
const bad = (msg: string) => Object.assign(new Error(msg), { isValidation: true });
// Najniższa wartość zamówienia, przy której działa kod rabatowy (zł).
const MIN_ORDER_ZL = 49;
// Kody rabatowe: weryfikacja i wyliczenie rabatu (w groszach) po stronie serwera.
// lines: [{ product_id, unit, qty }] — ceny w groszach. buyerEmail — dla kodów przypisanych do konta (np. powitalnych).
// sessionEmail — e-mail zalogowanego konta (z sesji, nie z formularza); potrzebny dla kodów „tylko dla osób z kontem”.
export async function applyDiscount(base44, rawCode, lines, buyerEmail = "", sessionEmail = "") {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) return null;
  const found = (await base44.asServiceRole.entities.DiscountCode.filter({ code, active: true }))[0];
  if (!found) throw new Error("Nieprawidłowy kod rabatowy");
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
  if (found.od && String(found.od) > today) throw bad(`Ten kod działa od ${String(found.od).split("-").reverse().join(".")}`);
  if (found.valid_until && found.valid_until < today) throw new Error("Kod rabatowy wygasł");
  const buyer = String(buyerEmail || "").trim().toLowerCase();
  // Tylko dla osób z kontem: trzeba być zalogowanym i kupować na adres tego konta.
  if (found.tylko_konto === true) {
    const me = String(sessionEmail || "").trim().toLowerCase();
    if (!me) throw bad("Ten kod działa po zalogowaniu na konto");
    if (buyer && buyer !== me) throw bad("Ten kod działa dla adresu e-mail zalogowanego konta");
  }
  // Tylko dla subskrybentów Listów Powrotu: adres kupującego musi mieć potwierdzony zapis.
  if (found.tylko_subskrybenci === true) {
    if (!buyer) throw bad("Ten kod jest dla subskrybentów Listów Powrotu — najpierw wpisz w kasie swój adres e-mail");
    const [s] = await runSql(base44, `SELECT 1 AS ok FROM public.subscribers WHERE lower(email) = ${escStr(buyer)} AND status = 'active' LIMIT 1`, true);
    if (!s?.ok) throw bad("Ten kod jest dla subskrybentów Listów Powrotu — ten adres e-mail nie ma potwierdzonego zapisu");
  }
  if (found.max_uses && (found.uses || 0) >= found.max_uses) throw new Error("Kod rabatowy został już wykorzystany");
  // Kod przypisany do konta (powitalny): działa wyłącznie z adresem e-mail tego konta.
  if (found.email) {
    const who = String(buyerEmail || "").trim().toLowerCase();
    if (!who) throw bad("Ten kod jest przypisany do konta — najpierw wpisz w kasie adres e-mail tego konta");
    if (who !== String(found.email).toLowerCase()) throw bad("Ten kod jest przypisany do innego adresu e-mail");
  }
  const ids = found.product_ids || [];
  // Karty podarunkowe nie wchodzą do podstawy żadnego rabatu: kodem z karty nie opłaca się innej karty,
  // a zwykły kod nie obniża ceny karty (karta ma wartość równą zapłaconej kwocie).
  const pids = [...new Set(lines.map((l) => String(l.product_id)))];
  const rows = pids.length ? await runSql(base44, `SELECT id::text AS id FROM public.products WHERE product_type = 'karta' AND id::text IN (${pids.map(escStr).join(",")})`, true) : [];
  const cards = rows.map((r) => r.id);
  const fromCard = String(found.opis || "").startsWith("Karta podarunkowa");
  // Ograniczenia kodu: rodzaje produktów (typy) i tylko cena regularna (bez_promocji — bez przedsprzedaży i promocji).
  const typy = Array.isArray(found.typy) ? found.typy.map(String) : [];
  let allowed = null;
  if (pids.length && (typy.length || found.bez_promocji === true)) {
    const info = await runSql(base44, `SELECT id::text AS id, product_type, price_regular::float8 AS price_regular, price::float8 AS price
      FROM public.products WHERE id::text IN (${pids.map(escStr).join(",")})`, true);
    const byId = new Map(info.map((r) => [String(r.id), r]));
    allowed = new Set(lines.filter((l) => {
      const p = byId.get(String(l.product_id));
      if (!p) return false;
      if (typy.length && !typy.includes(String(p.product_type || ""))) return false;
      const regular = Math.round(Number(p.price_regular ?? p.price) * 100);
      if (found.bez_promocji === true && Number.isFinite(regular) && l.unit < regular) return false;
      return true;
    }).map((l) => String(l.product_id)));
  }
  const base = lines
    .filter((l) => !cards.includes(String(l.product_id)))
    .filter((l) => ids.length === 0 || ids.includes(String(l.product_id)))
    .filter((l) => !allowed || allowed.has(String(l.product_id)))
    .reduce((s, l) => s + l.unit * l.qty, 0);
  const onlyCards = lines.length > 0 && lines.every((l) => cards.includes(String(l.product_id)));
  if (base === 0 && found.bez_promocji === true && !onlyCards && allowed && allowed.size === 0) throw bad("Ten kod działa tylko w cenie regularnej — teraz obowiązuje niższa cena promocyjna");
  if (base === 0) throw new Error(onlyCards ? (fromCard ? "Kodem z karty podarunkowej nie opłacisz innej karty podarunkowej" : "Kodów rabatowych nie łączy się z kartą podarunkową") : "Kod nie obejmuje produktów w koszyku");
  // Minimalna wartość objętych kodem produktów (np. kod 20 zł po zakupie: od 49 zł).
  // Każdy kod rabatowy działa od 49 zł (wyższy próg z panelu wygrywa). Karta podarunkowa to zapłacone pieniądze — bez progu.
  const minZl = fromCard ? (Number(found.min_zl) || 0) : Math.max(MIN_ORDER_ZL, Number(found.min_zl) || 0);
  if (minZl > 0 && base < Math.round(minZl * 100)) {
    throw bad(`Ten kod działa przy zamówieniu od ${minZl} zł (e-booki, audio, kursy, pakiety)`);
  }
  const off = found.kind === "kwota"
    ? Math.min(base, Math.round(found.value * 100))
    : Math.round((base * Math.min(100, found.value)) / 100);
  const eligible = lines.filter((l) => !cards.includes(String(l.product_id)) && (ids.length === 0 || ids.includes(String(l.product_id))) && (!allowed || allowed.has(String(l.product_id)))).map((l) => String(l.product_id));
  return { record: found, code, discount: off, eligible };
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
// RESERVE_SQL zostaje jako wzór — tabelę i funkcję exm_reserve_code zakłada migracja. Struktura zakładana migracją docs/tech/migracje/2026-11-05_payu.sql — bez DDL w trakcie zakupu.
export async function reserveCode(base44, record, orderId, email) {
  const max = Number(record?.max_uses) || 0;
  if (!max) return false; // kod bez limitu użyć — nie ma czego rezerwować
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