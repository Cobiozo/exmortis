import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, esc, escStr, textField, requireAdmin } from "../../shared/supabase.ts";
import { loadAppUrl, APP_URL as APP } from "../../shared/settings.ts";
import { sendMail } from "../../shared/smtp.ts";
import { emailButton } from "../../shared/emailLayout.ts";
import { ensureSurveyColumns, newSurveyToken, SURVEY_DAYS, surveyLink, firstName, wrap, escHtml } from "../../shared/powrotSurvey.ts";

// Panel POWRÓT: lista zgłoszeń (etap 1 + odpowiedzi ankiety) i wysyłka osobistego linku do ankiety.
// Wyłącznie administrator — dane zawierają informacje o sytuacji życiowej i zdrowiu.

const FIELDS = `id, created_date, full_name, email, phone, age, return_from, return_from_other, situation,
  duration, affected_areas, tried_before, therapy_support, goal, obstacle, readiness, weekly_time, work_form,
  investment, anything_else, source, contact_pref, consent_rodo, consent_paid, consent_health, pilne,
  survey_sent_at, survey_expires_at, survey_done_at, wspolpraca_od, wspolpraca_do`;

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    await requireAdmin(base44);
    const body = await req.json().catch(() => ({}));
    await ensureSurveyColumns(base44);

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
}