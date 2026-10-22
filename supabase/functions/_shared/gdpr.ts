import { runSql, rpc, escStr } from "./supabase.ts";
import { consentFilter } from "./mirror.ts";

// RODO art. 15 i 17 — wspólne dla narzędzia administratora i „Twoich danych” w koncie klienta.
// Zostają (art. 17 ust. 3 lit. b i e): zamówienia, odstąpienia, licencje i dowody zgód.
export const SB = {
  registrations: "email", contact_messages: "email", orders: "buyer_email", podcast_applications: "email",
  powrot_applications: "email", quiz_result: "email", subscribers: "email", campaign_recipients: "email",
  users: "email", waitlist: "email", webinar_1_11: "email",
  // Rezerwacje 1:1 (kolejność ma znaczenie: rezerwacje przed pakietami — klucz obcy).
  // Dowody zgód (bk_consents) zostają: po usunięciu rezerwacji nie mają już adresu, tylko skrót.
  bk_bookings: "email", bk_packages: "email_display",
  // Biblioteka i wiadomości: grupy ręczne, przydziały wprost, stan materiałów, wysłane wiadomości.
  // Przydziały grupowe i historia zmian zostają (nie są danymi osoby) — historia jest anonimizowana.
  mb_group_members: "client_email", mb_assignments: "target_email",
  mb_material_state: "client_email", mb_message_recipients: "client_email",
  // Opinie kupujących (podpis i treść są anonimizowane razem z wierszem).
  product_reviews: "email",
  // Bilety na spotkania, kody zarezerwowane przy nieopłaconym zamówieniu i linki do zarządzania
  // rezerwacją albo pakietem.
  event_tickets: "buyer_email", discount_reservations: "email", bk_tokens: "owner_email",
};

// Tabele powstające dopiero przy pierwszym użyciu: zapytanie do brakującej tabeli przerywa cały
// eksport, więc brak tabeli traktujemy jak brak danych.
export const OPTIONAL = new Set(["event_tickets", "discount_reservations"]);
export const APP = {
  Consent: "email", ContactMessage: "email", PodcastApplication: "email", PodcastGuest: "email",
  PowrotApplication: "email", Withdrawal: "email", PendingRegistration: "email", Access: "user_email",
  ActiveStream: "user_email", LessonProgress: "user_email", License: "user_email", ObokOdsluch: "user_email",
  ObokUczestnik: "user_email", PlaybackLog: "user_email", SecurityLog: "user_email",
  // Karty podarunkowe (dane darczyńcy i obdarowanego) i dziennik wysłanej poczty.
  DiscountCode: "buyer_email", MailQueue: "to_email",
};
// Wiersze, których nie usuwamy: dowód księgowy i dowody zgody. Bilety opłacone zostają wyłącznie
// po to, żeby je zanonimizować (patrz anonymizePaid).
export const KEEP = new Set(["orders", "Withdrawal", "License", "Consent", "event_tickets", "order_refunds"]);

const rx = (email) => ({ $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" });

export const maskEmail = (email) => { const [u, d] = email.split("@"); return `${u[0]}***@${d}`; };

export async function collectPerson(base44, email) {
  const sr = base44.asServiceRole.entities;
  const sbData = {};
  await Promise.all(Object.entries(SB).map(async ([t, col]) => {
    sbData[t] = await runSql(base44, `SELECT * FROM public.${t} WHERE lower(${col}) = ${escStr(email)}`, true)
      .catch((e) => { if (OPTIONAL.has(t)) return []; throw e; });
  }));
  const appData = {};
  for (const [e, f] of Object.entries(APP)) {
    appData[e] = e === "Consent"
      ? await consentFilter(base44, { [f]: rx(email) }, "-created_date", 1000)
      : await sr[e].filter({ [f]: rx(email) }, "-created_date", 1000);
  }
  // Zwroty PayU: dowód księgowy przypisany do zamówienia (bez adresu w wierszu) — szukamy po numerach zamówień osoby.
  const ords = sbData.orders || [];
  if (ords.length) {
    sbData.order_refunds = await runSql(base44,
      `SELECT * FROM public.order_refunds WHERE order_id IN (${ords.map((r) => escStr(String(r.id))).join(",")})`, true).catch(() => []);
  }
  // Odpowiedzi z formularza rezerwacji (dane o zdrowiu są zaszyfrowane — zwracamy postać zaszyfrowaną).
  const bks = sbData.bk_bookings || [];
  if (bks.length) {
    sbData.bk_answers = await runSql(base44, `SELECT * FROM public.bk_answers WHERE booking_id IN (${bks.map((r) => escStr(r.id)).join(",")})`, true).catch(() => []);
  }
  // Treść wiadomości, które ta osoba otrzymała — same nagłówki i treść, bez listy odbiorców.
  const rcpt = sbData.mb_message_recipients || [];
  if (rcpt.length) {
    sbData.mb_messages = await runSql(base44, `SELECT id, title, body_html, sent_at FROM public.mb_messages
      WHERE id IN (${rcpt.map((r) => escStr(r.message_id)).join(",")})`, true).catch(() => []);
  }
  const account = (await sr.User.filter({ email })).map((u) => ({ id: u.id, email: u.email, full_name: u.full_name, role: u.role, created_date: u.created_date }));
  return { sbData, appData, account };
}

const ANON = "dane usunięte (RODO)";
const ANON_EMAIL = "usuniete@exmortis.pl";

// Zamówienia, opłacone bilety i wydane karty podarunkowe: wiersz zostaje (obowiązek podatkowy —
// kwota, numer i data), a dane osobowe są w nim anonimizowane. Dedykacje w pozycjach zamówienia
// i notatka nie są danymi księgowymi — znikają. Bilety bezpłatne i kody zarezerwowane przy
// nieopłaconym zamówieniu nie mają wartości księgowej, więc usuwa je zwykły przebieg.
export async function anonymizePaid(base44, email) {
  const e = escStr(email);
  const sr = base44.asServiceRole.entities;
  const out = {};
  const orders = await runSql(base44, `UPDATE public.orders
      SET buyer_name = ${escStr(ANON)}, buyer_phone = NULL, phone_consent_date = NULL, note = NULL,
          items = CASE WHEN jsonb_typeof(items) = 'array'
            THEN (SELECT jsonb_agg(it - 'gift_to' - 'gift_message') FROM jsonb_array_elements(items) it)
            ELSE items END
    WHERE lower(buyer_email) = ${e} RETURNING id`).catch(() => []);
  if (orders.length) out["Supabase: orders (anonimizacja)"] = orders.length;
  // Zwroty zostają (księgowość) — anonimizujemy tylko powód, który bywa opisem sprawy osoby.
  const refunds = await runSql(base44, `UPDATE public.order_refunds SET reason = ${escStr(ANON)}
    WHERE order_id IN (SELECT id FROM public.orders WHERE lower(buyer_email) = ${e}) RETURNING 1`).catch(() => []);
  if (refunds.length) out["Supabase: order_refunds (anonimizacja)"] = refunds.length;
  // Tabela biletów powstaje przy pierwszym bilecie — jej brak nie może przewrócić usuwania konta.
  const free = await runSql(base44, `DELETE FROM public.event_tickets WHERE lower(buyer_email) = ${e} AND price <= 0 RETURNING 1`).catch(() => []);
  if (free.length) out["Supabase: event_tickets (bezpłatne)"] = free.length;
  const paid = await runSql(base44, `UPDATE public.event_tickets SET holder_name = ${escStr(ANON)}, buyer_email = NULL
    WHERE lower(buyer_email) = ${e} RETURNING 1`).catch(() => []);
  if (paid.length) out["Supabase: event_tickets (anonimizacja)"] = paid.length;
  const cards = await sr.DiscountCode.filter({ buyer_email: rx(email) }, "-created_date", 1000).catch(() => []);
  if (cards.length) {
    await sr.DiscountCode.bulkUpdate(cards.map((c) => ({ id: c.id, buyer_email: null, gift_to: null, gift_message: null, gift_token: null })));
    out["Aplikacja: DiscountCode (anonimizacja)"] = cards.length;
  }
  return out;
}

// Proces zmiany adresu trzyma kopię wszystkich danych osoby (do przywrócenia) oraz oba adresy.
// Kopia znika zawsze, adresy zostają zastąpione — panel pokazuje je i tak zamaskowane.
const OPEN_CHANGE = ["wyslano", "podano", "przyjeto", "przenoszenie", "blad"];
export async function scrubEmailChange(base44, email) {
  const sr = base44.asServiceRole.entities;
  const rows = [
    ...(await sr.EmailChange.filter({ old_email: email }, "-created_date", 200).catch(() => [])),
    ...(await sr.EmailChange.filter({ new_email: email }, "-created_date", 200).catch(() => [])),
  ];
  for (const c of rows) {
    await sr.EmailChange.update(c.id, OPEN_CHANGE.includes(c.status)
      ? { kopia: null }                                                              // proces w toku — adresy są jeszcze potrzebne
      : { kopia: null, old_email: ANON_EMAIL, new_email: null, blad: null });
  }
  return rows.length;
}

export async function deletePerson(base44, email, { sbData, appData, account }) {
  const sr = base44.asServiceRole.entities;
  const removed = {};
  for (const [t, col] of Object.entries(SB)) {
    if (KEEP.has(t) || !sbData[t].length) continue;
    const r = await runSql(base44, `DELETE FROM public.${t} WHERE lower(${col}) = ${escStr(email)} RETURNING 1`);
    removed[`Supabase: ${t}`] = r.length;
  }
  for (const [e, rows] of Object.entries(appData)) {
    if (KEEP.has(e) || !rows.length) continue;
    await sr[e].deleteMany({ id: { $in: rows.map((x) => x.id) } });
    removed[`Aplikacja: ${e}`] = rows.length;
  }
  // Rejestr działań: wpisy dotyczące usuniętych rezerwacji i pakietów zostają zanonimizowane.
  const ids = [...(sbData.bk_bookings || []), ...(sbData.bk_packages || [])].map((r) => String(r.id));
  if (ids.length) await rpc(base44, "bk_log_anonymize", { p_actor: email, p_object_ids: ids }).catch(() => {});
  // Historia zmian biblioteki: wpisy o tej osobie zanonimizowane (funkcja z właścicielem mb_log_maint).
  await rpc(base44, "mb_log_anonymize", { p_email: email }).catch(() => {});
  // Adresy zamrożone przy przydziale grupowym mogą zawierać tę osobę w cudzym wierszu.
  await runSql(base44, `UPDATE public.mb_assignments SET snapshot_emails = snapshot_emails - ${escStr(email)}::text
    WHERE snapshot_emails @> to_jsonb(${escStr(email)}::text)`).catch(() => {});
  // Zamówienia, bilety i karty podarunkowe: dane księgowe zostają, dane osobowe są anonimizowane.
  Object.assign(removed, await anonymizePaid(base44, email));
  // Proces zmiany adresu: kopia pełnych danych osoby znika, adresy zostają zastąpione.
  const zmiany = await scrubEmailChange(base44, email);
  if (zmiany) removed["Aplikacja: EmailChange (anonimizacja)"] = zmiany;
  let konto = "brak";
  for (const u of account) {
    if (u.role === "admin") { konto = "konto administratora — nie usuwam"; continue; }
    // Stan powiadomień i „widziane ogłoszenia” są przypisane do id konta, nie do e-maila.
    for (const e of ["NotificationState", "AnnouncementSeen"]) {
      const n = await sr[e].filter({ user_id: u.id }, "-created_date", 1000).catch(() => []);
      if (n.length) { await sr[e].deleteMany({ id: { $in: n.map((x) => x.id) } }).catch(() => {}); removed[`Aplikacja: ${e}`] = n.length; }
    }
    konto = await sr.User.delete(u.id).then(() => "usunięte").catch(() => "usuń ręcznie w panelu: Użytkownicy aplikacji");
  }
  return { removed, konto, total: Object.values(removed).reduce((a, b) => a + b, 0) };
}