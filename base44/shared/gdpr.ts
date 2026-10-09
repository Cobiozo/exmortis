import { runSql, escStr } from "./supabase.ts";

// RODO art. 15 i 17 — wspólne dla narzędzia administratora i „Twoich danych” w koncie klienta.
// Zostają (art. 17 ust. 3 lit. b i e): zamówienia, odstąpienia, licencje i dowody zgód.
export const SB = {
  registrations: "email", contact_messages: "email", orders: "buyer_email", podcast_applications: "email",
  powrot_applications: "email", quiz_result: "email", subscribers: "email", campaign_recipients: "email",
  users: "email", waitlist: "email", webinar_1_11: "email",
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
  let konto = "brak";
  for (const u of account) {
    if (u.role === "admin") { konto = "konto administratora — nie usuwam"; continue; }
    konto = await sr.User.delete(u.id).then(() => "usunięte").catch(() => "usuń ręcznie w panelu: Użytkownicy aplikacji");
  }
  return { removed, konto, total: Object.values(removed).reduce((a, b) => a + b, 0) };
}