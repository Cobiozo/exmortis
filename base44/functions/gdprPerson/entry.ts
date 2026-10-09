import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { runSql, escStr, emailField } from "../../shared/supabase.ts";

// RODO art. 15 i 17: znajdź / wyeksportuj / usuń dane osoby po e-mailu — w Supabase i w bazie aplikacji naraz.
// Zostają (art. 17 ust. 3 lit. b i e): zamówienia, odstąpienia, licencje i dowody zgód.

const SB = {
  registrations: "email", contact_messages: "email", orders: "buyer_email", podcast_applications: "email",
  powrot_applications: "email", quiz_result: "email", subscribers: "email", campaign_recipients: "email",
  users: "email", waitlist: "email", webinar_1_11: "email",
};
const APP = {
  Consent: "email", ContactMessage: "email", PodcastApplication: "email", PodcastGuest: "email",
  PowrotApplication: "email", Withdrawal: "email", PendingRegistration: "email", Access: "user_email",
  ActiveStream: "user_email", LessonProgress: "user_email", License: "user_email", ObokOdsluch: "user_email",
  ObokUczestnik: "user_email", PlaybackLog: "user_email", SecurityLog: "user_email",
};
const KEEP = new Set(["orders", "Withdrawal", "License", "Consent"]);

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (me?.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const email = emailField(body).toLowerCase();
    const sr = base44.asServiceRole.entities;
    const [u0, dom] = email.split("@");
    const log = (akcja, zakres, liczba?) => sr.DataAccessLog.create({ kto: me.email, akcja, zakres, osoba: `${u0[0]}***@${dom}`, liczba, at: new Date().toISOString() });

    // Oznaczenie współpracy POWRÓT (decyduje o okresie przechowywania zgłoszenia).
    if (body.action === "powrot") {
      const col = body.field === "do" ? "wspolpraca_do" : "wspolpraca_od";
      await runSql(base44, `UPDATE public.powrot_applications SET ${col} = ${body.clear ? "NULL" : "current_date"} WHERE lower(email) = ${escStr(email)}`);
      await log("zmiana", `POWRÓT: ${col} ${body.clear ? "wyczyszczone" : "= dziś"}`);
      return Response.json({ ok: true });
    }

    const sbData = {};
    await Promise.all(Object.entries(SB).map(async ([t, col]) => {
      sbData[t] = await runSql(base44, `SELECT * FROM public.${t} WHERE lower(${col}) = ${escStr(email)}`, true);
    }));
    const appData = {};
    for (const [e, f] of Object.entries(APP)) {
      appData[e] = await sr[e].filter({ [f]: { $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } }, "-created_date", 1000);
    }
    const account = (await sr.User.filter({ email })).map((u) => ({ id: u.id, email: u.email, full_name: u.full_name, role: u.role, created_date: u.created_date }));

    if (body.action === "find" || body.action === "export") {
      const summary = [
        ...Object.entries(sbData).map(([t, r]) => ({ baza: "Supabase", zbior: t, liczba: r.length, zostaje: KEEP.has(t) })),
        ...Object.entries(appData).map(([e, r]) => ({ baza: "Aplikacja", zbior: e, liczba: r.length, zostaje: KEEP.has(e) })),
        { baza: "Aplikacja", zbior: "Konto (User)", liczba: account.length, zostaje: false },
      ].filter((x) => x.liczba > 0);
      await log(body.action === "find" ? "otwarcie" : "eksport", body.action === "find" ? "Narzędzie RODO: wyszukanie" : "Narzędzie RODO: eksport JSON");
      if (body.action === "find") return Response.json({ email, summary, powrot: sbData.powrot_applications.map((r) => ({ id: r.id, created_date: r.created_date, wspolpraca_od: r.wspolpraca_od, wspolpraca_do: r.wspolpraca_do })) });
      return Response.json({ email, wygenerowano: new Date().toISOString(), supabase: sbData, aplikacja: appData, konto: account });
    }

    if (body.action === "delete") {
      if (String(body.confirm || "").toLowerCase() !== email) return Response.json({ error: "Wpisz adres, aby potwierdzić." }, { status: 400 });
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
      await log("usuniecie", "Narzędzie RODO: usunięcie danych", Object.values(removed).reduce((a, b) => a + b, 0));
      return Response.json({ email, removed, konto, zostaje: [...KEEP] });
    }
    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}