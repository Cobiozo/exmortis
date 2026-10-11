import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { runSql, escStr, clientIp } from "../../shared/supabase.ts";
import { sendConfirmMail } from "../../shared/newsletter.ts";
import { LISTY_TEXT } from "../../shared/registrations.ts";
import { collectPerson, deletePerson, maskEmail } from "../../shared/gdpr.ts";

// Ustawienia konta klienta: Listy powrotu (stan z bazy), eksport i usunięcie własnych danych.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me) return Response.json({ error: "Zaloguj się" }, { status: 401 });
    const email = String(me.email).toLowerCase();
    const body = await req.json().catch(() => ({}));
    const sr = base44.asServiceRole.entities;
    const ip = clientIp(req);
    const sub = async () => (await runSql(base44, `SELECT status, updated_date FROM public.subscribers WHERE lower(email) = ${escStr(email)}`, true))[0];
    const state = (s) => (s?.status === "active" ? "on" : s?.status === "pending" ? "pending" : "off");
    const log = (akcja, zakres, liczba?) => sr.DataAccessLog.create({ kto: email, akcja, zakres, osoba: maskEmail(email), liczba, at: new Date().toISOString() });

    if (body.action === "listy") return Response.json({ state: state(await sub()) });

    if (body.action === "listy_on" || body.action === "listy_resend") {
      const s = await sub();
      if (s?.status === "active") return Response.json({ state: "on" });
      if (body.action === "listy_resend" && s?.updated_date && Date.now() - new Date(s.updated_date).getTime() < 600000) {
        return Response.json({ error: "Link można wysłać ponownie za kilka minut.", state: "pending" }, { status: 429 });
      }
      const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const name = String(me.imie || me.full_name || "").slice(0, 200) || null;
      await runSql(base44, `INSERT INTO public.subscribers (id, email, name, status, confirm_token, confirm_sent_at, updated_date)
        VALUES (gen_random_uuid()::text, ${escStr(email)}, ${name ? escStr(name) : "NULL"}, 'pending', ${escStr(token)}, NULL, now())
        ON CONFLICT (email) DO UPDATE SET status = 'pending', confirm_token = EXCLUDED.confirm_token, confirm_sent_at = NULL, updated_date = now()`);
      await sendConfirmMail(base44, { email, name, token }).catch((e) => console.error("Listy: potwierdzenie", e.message));
      return Response.json({ state: "pending" });
    }

    if (body.action === "listy_off") {
      await runSql(base44, `UPDATE public.subscribers SET status = 'unsubscribed', confirm_token = NULL, updated_date = now() WHERE lower(email) = ${escStr(email)}`);
      const at = new Date().toISOString();
      const given = await sr.Consent.filter({ email, kind: "newsletter", status: "udzielona" }, "-created_date", 50);
      if (given.length) await sr.Consent.bulkUpdate(given.map((c) => ({ id: c.id, status: "wycofana", withdrawn_at: at })));
      else await sr.Consent.create({ email, kind: "newsletter", text: `Wycofanie: ${LISTY_TEXT}`, source: "konto:ustawienia", given_at: at, ip, status: "wycofana", withdrawn_at: at, doc_version: "1.1" });
      return Response.json({ state: "off", withdrawn_at: at });
    }

    if (body.action === "export") {
      const { sbData, appData, account } = await collectPerson(base44, email);
      await log("eksport", "Konto klienta: pobranie własnych danych");
      return Response.json({ email, wygenerowano: new Date().toISOString(), supabase: sbData, aplikacja: appData, konto: account });
    }

    if (body.action === "delete") {
      if (me.role === "admin") return Response.json({ error: "Konta administratora nie można usunąć stąd." }, { status: 400 });
      if (String(body.confirm || "").trim().toLowerCase() !== email) return Response.json({ error: "Wpisz swój adres e-mail, aby potwierdzić." }, { status: 400 });
      const r = await deletePerson(base44, email, await collectPerson(base44, email));
      await log("usuniecie", "Konto klienta: usunięcie konta na własne żądanie", r.total);
      return Response.json({ ok: true, konto: r.konto });
    }
    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Coś poszło nie tak. Spróbuj za chwilę." }, { status: 500 });
  }
}