import { createClientFromRequest } from "../_shared/compat.ts";
import { runSql, esc, escStr, textField, requireAdmin } from "../_shared/supabase.ts";
import { loadAppUrl, APP_URL as APP } from "../_shared/settings.ts";
import { sendMail } from "../_shared/smtp.ts";
import { emailButton } from "../_shared/emailLayout.ts";
import { ensureSurveyColumns, newSurveyToken, SURVEY_DAYS, surveyLink, firstName, wrap, escHtml } from "../_shared/powrotSurvey.ts";
import { ensurePayColumns, PAY_DAYS, PAY_MIN, PAY_MAX, payLink } from "../_shared/powrotPay.ts";
import { docAttachment, regulaminAttachment, docLatest } from "../_shared/legalDocs.ts";

// Panel POWRÓT: lista zgłoszeń (etap 1 + odpowiedzi ankiety) i wysyłka osobistego linku do ankiety.
// Wyłącznie administrator — dane zawierają informacje o sytuacji życiowej i zdrowiu.

const FIELDS = `id, created_date, full_name, email, phone, age, return_from, return_from_other, situation,
  duration, affected_areas, tried_before, therapy_support, goal, obstacle, readiness, weekly_time, work_form,
  investment, anything_else, source, contact_pref, consent_rodo, consent_paid, consent_health, pilne,
  survey_sent_at, survey_expires_at, survey_done_at, wspolpraca_od, wspolpraca_do,
  pay_amount, pay_sent_at, pay_expires_at, paid_at`;

const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const admin = await requireAdmin(base44);
    const body = await req.json().catch(() => ({}));
    await ensureSurveyColumns(base44);
    await ensurePayColumns(base44);

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

    // Link do płatności: osobisty, ważny PAY_DAYS dni; nowy link unieważnia poprzedni.
    // Wysyłany wyłącznie przez administratora, po rozmowie kwalifikacyjnej.
    if (body.action === "pay") {
      const id = textField(body, "id", { max: 64 });
      const amount = Math.round(Number(body.amount) * 100) / 100;
      if (!Number.isFinite(amount) || amount < PAY_MIN || amount > PAY_MAX) {
        return Response.json({ error: `Kwota musi być między ${PAY_MIN} a ${PAY_MAX} zł.` }, { status: 400 });
      }
      const found = await runSql(base44, `SELECT id, full_name, email, paid_at FROM public.powrot_applications WHERE id = ${esc(id)}`, true);
      const app = found && found[0];
      if (!app) return Response.json({ error: "Nie znaleziono zgłoszenia." }, { status: 404 });
      if (app.paid_at) return Response.json({ error: "Program jest już opłacony." }, { status: 400 });
      // Umowa musi być w archiwum dokumentów — klient dostaje ją przed zapłatą jako załącznik (trwały nośnik).
      const umowa = await docAttachment(base44, "umowa_powrot", "Umowa-POWROT-exmortis");
      const ver = await docLatest(base44, "umowa_powrot");
      if (!umowa || !ver) {
        return Response.json({ error: "Najpierw zapisz Umowę POWRÓT: Ustawienia → Dokumenty prawne → Zapisz." }, { status: 400 });
      }
      const reg = await regulaminAttachment(base44);

      const token = newSurveyToken();
      const updated = await runSql(
        base44,
        `UPDATE public.powrot_applications SET
           pay_token = ${escStr(token)}, pay_amount = ${amount}, pay_sent_at = now(),
           pay_expires_at = now() + interval '${PAY_DAYS} days', updated_date = now()
         WHERE id = ${esc(id)}
         RETURNING pay_sent_at, pay_expires_at`
      );

      await loadAppUrl(base44).catch(() => {});
      const link = payLink(APP, token);
      const kwota = amount.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
      const mail = await sendMail(base44, {
        kind: "powrot_platnosc", ref: app.id, to: app.email,
        subject: "EXMORTIS · POWRÓT — umowa i link do płatności",
        attachments: [umowa, ...(reg ? [reg] : [])],
        html: wrap(
          `<p>${escHtml(firstName(app.full_name))}, dziękuję za rozmowę. Cieszę się, że chcesz przejść POWRÓT.</p>
           <p>W załączniku jest Umowa o udział w programie POWRÓT (wersja ${escHtml(ver.version)}) i Regulamin. Przeczytaj je spokojnie przed płatnością.</p>
           <p>Cena programu: <strong>${escHtml(kwota)} zł</strong>. Płatność przez PayU — także odroczona albo w ratach PayPo, jeśli PayPo udostępni ją dla Twojej płatności.</p>
           <p style="margin:28px 0">${emailButton("PRZEJDŹ DO PŁATNOŚCI", link)}</p>
           <p style="font-size:13px;color:#8A8A8C">Link jest osobisty i ważny ${PAY_DAYS} dni. Termin pierwszej sesji ustalimy po zawarciu umowy.</p>
           <p>Dawid, exmortis</p>`
        ),
      });

      return Response.json({
        ok: true,
        mail,
        pay_amount: amount,
        pay_sent_at: updated && updated[0] ? updated[0].pay_sent_at : null,
        pay_expires_at: updated && updated[0] ? updated[0].pay_expires_at : null,
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