import { runSql, rpc, escStr } from "./supabase.ts";

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
};
export const APP = {
  Consent: "email", ContactMessage: "email", PodcastApplication: "email", PodcastGuest: "email",
  PowrotApplication: "email", Withdrawal: "email", PendingRegistration: "email", Access: "user_email",
  ActiveStream: "user_email", LessonProgress: "user_email", License: "user_email", ObokOdsluch: "user_email",
  ObokUczestnik: "user_email", PlaybackLog: "user_email", SecurityLog: "user_email",
};
export const KEEP = new Set(["orders", "Withdrawal", "License", "Consent"]);

export const maskEmail = (email) => { const [u, d] = email.split("@"); return `${u[0]}***@${d}`; };

export async function collectPerson(base44, email) {
  const sr = base44.asServiceRole.entities;
  const sbData = {};
  await Promise.all(Object.entries(SB).map(async ([t, col]) => {
    sbData[t] = await runSql(base44, `SELECT * FROM public.${t} WHERE lower(${col}) = ${escStr(email)}`, true);
  }));
  const appData = {};
  for (const [e, f] of Object.entries(APP)) {
    appData[e] = await sr[e].filter({ [f]: { $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } }, "-created_date", 1000);
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