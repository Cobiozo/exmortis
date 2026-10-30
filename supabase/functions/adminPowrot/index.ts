import { createClientFromRequest } from "../_shared/compat.ts";
import { runSql, esc, escStr, textField, requireAdmin } from "../_shared/supabase.ts";
import { loadAppUrl, APP_URL as APP } from "../_shared/settings.ts";
import { sendMail } from "../_shared/smtp.ts";
import { emailButton } from "../_shared/emailLayout.ts";
import { ensureSurveyColumns, newSurveyToken, SURVEY_DAYS, surveyLink, firstName, wrap, escHtml } from "../_shared/powrotSurvey.ts";

// Panel POWRÓT: lista zgłoszeń (etap 1 + odpowiedzi ankiety) i wysyłka osobistego linku do ankiety.
// Wyłącznie administrator — dane zawierają informacje o sytuacji życiowej i zdrowiu.

const FIELDS = `id, created_date, full_name, email, phone, age, return_from, return_from_other, situation,
  duration, affected_areas, tried_before, therapy_support, goal, obstacle, readiness, weekly_time, work_form,
  investment, anything_else, source, contact_pref, consent_rodo, consent_paid, consent_health, pilne,
  survey_sent_at, survey_expires_at, survey_done_at, wspolpraca_od, wspolpraca_do`;

const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const admin = await requireAdmin(base44);
    const body = await req.json().catch(() => ({}));
    await ensureSurveyColumns(base44);

    // Usunięcie zgłoszenia: wyłącznie ten wiersz z powrot_applications (konto, newsletter,
    // zapisy na spotkania i inne dane osoby zostają nietknięte).
    if (body.action === "delete") {
      const id = textField(body, "id", { max: 64 });
      const found = await runSql(base44, `SELECT id, full_name, email FROM public.powrot_applications WHERE id = ${esc(id)}`, true);
      const app = found && found[0];
      if (!app) return Response.json({ error: "Nie znaleziono zgłoszenia." }, { status: 404 });

      const removed = await runSql(base44, `DELETE FROM public.powrot_applications WHERE id = ${esc(id)} RETURNING id`);
      if (!removed || !removed[0]) return Response.json({ error: "Nie znaleziono zgłoszenia." }, { status: 404 });

      // Wspólny dziennik danych osobowych (panel RODO → Historia): kto, kogo i kiedy usunął.
      await base44.asServiceRole.entities.DataAccessLog.create({
        kto: admin.email, akcja: "usuniecie", zakres: "POWRÓT: zgłoszenie usunięte w panelu",
        osoba: `${app.full_name} <${app.email}>`, liczba: 1, at: new Date().toISOString(),
      }).catch(() => {});

      return Response.json({ ok: true });
    }

    if (body.action === "survey") {
      const id = textField(body, "id", { max: 64 });
      const found = await runSql(base44, `SELECT ${FIELDS} FROM public.powrot_applications WHERE id = ${esc(id)}`, true);
      const app = found && found[0];
      if (!app) return Response.json({ error: "Nie znaleziono zgłoszenia." }, { status: 404 });
      if (app.survey_done_at) return Response.json({ error: "Ankieta jest już wypełniona." }, { status: 400 });

      // Nowy token unieważnia poprzedni link (kolumna jest nadpisywana).
      const token = newSurveyToken();
      const updated = await runSql(
        base44,
        `UPDATE public.powrot_applications SET
           survey_token = ${escStr(token)}, survey_sent_at = now(),
           survey_expires_at = now() + interval '${SURVEY_DAYS} days',
           survey_done_at = NULL, updated_date = now()
         WHERE id = ${esc(id)}
         RETURNING survey_sent_at, survey_expires_at`
      );

      await loadAppUrl(base44).catch(() => {});
      const link = surveyLink(APP, token);
      const mail = await sendMail(base44, {
        kind: "powrot_ankieta", ref: app.id, to: app.email,
        subject: "EXMORTIS · Ankieta przed rozmową — POWRÓT",
        html: wrap(
          `<p>${escHtml(firstName(app.full_name))}, dziękuję za zgłoszenie.</p>
           <p>Zanim porozmawiamy, proszę o wypełnienie krótkiej ankiety — pomoże mi przygotować się do rozmowy z Tobą.</p>
           <p>Zajmie około 10 minut. Link jest osobisty i ważny ${SURVEY_DAYS} dni.</p>
           <p style="margin:28px 0">${emailButton("WYPEŁNIJ ANKIETĘ", link)}</p>`
        ),
      });

      return Response.json({
        ok: true,
        mail,
        survey_sent_at: updated && updated[0] ? updated[0].survey_sent_at : null,
        survey_expires_at: updated && updated[0] ? updated[0].survey_expires_at : null,
      });
    }

    const rows = await runSql(
      base44,
      `SELECT ${FIELDS} FROM public.powrot_applications
         ORDER BY pilne DESC NULLS LAST, created_date DESC LIMIT 300`,
      true
    );
    return Response.json({ applications: Array.isArray(rows) ? rows : [] });
  } catch (error) {
    const msg = String(error?.message || error);
    return Response.json({ error: msg === "FORBIDDEN" ? "Brak dostępu" : msg }, { status: msg === "FORBIDDEN" ? 403 : 400 });
  }
};

// === Supabase Edge (wygenerowane przez docs/tech/migruj.mjs) ===
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const res = await handler(req);
    const h = new Headers(res.headers);
    for (const [k, v] of Object.entries(CORS)) h.set(k, v);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  } catch (e) {
    const msg = String(e?.message || e);
    const status = msg === "FORBIDDEN" ? 403 : e && e.isValidation ? 400 : 500;
    console.error("edge:", msg.slice(0, 300));
    return Response.json({ error: msg.slice(0, 300) }, { status, headers: CORS });
  }
});