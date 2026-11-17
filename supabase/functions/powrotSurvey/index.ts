import { createClientFromRequest } from "../_shared/compat.ts";
import { waitUntil } from "../_shared/shim.ts";
import { runSql, esc, escStr, textField, clientIp } from "../_shared/supabase.ts";
import { ipAllowed, TOO_MANY } from "../_shared/rateLimit.ts";
import { isUrgent, notifyUrgent } from "../_shared/crisis.ts";
import { loadAppUrl, APP_URL as APP } from "../_shared/settings.ts";
import { sendMail, adminTo } from "../_shared/smtp.ts";
import { ensureSurveyColumns, tokenOk, wrap, escHtml, bad, list, jsonb } from "../_shared/powrotSurvey.ts";

// Drugi etap zgłoszenia POWRÓT: osobisty link do pełnej ankiety.
// Wejście publiczne — chronione wyłącznie tokenem (64 hex) i limitem z jednego adresu IP.
// Odczyt zwraca tylko imię, e-mail i własną odpowiedź z etapu 1 (bez reszty danych).

// Helpery wspólne z etapem 1 (wrap, escHtml, bad, num1to10, list, jsonb) — _shared/powrotSurvey.ts.

const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const token = String(body.t ?? "").trim().toLowerCase();
    const action = body.action === "submit" ? "submit" : "get";
    if (!tokenOk(token)) return Response.json({ state: "invalid" });

    // Limit prób z jednego połączenia — jak w pozostałych publicznych formularzach.
    if (!(await ipAllowed(base44, clientIp(req), "powrot_ankieta", action === "submit" ? 5 : 30, 3600000)))
      return Response.json({ error: TOO_MANY }, { status: 429 });

    await ensureSurveyColumns(base44);
    const rows = await runSql(
      base44,
      `SELECT id, full_name, email, situation, pilne, survey_done_at, survey_expires_at
         FROM public.powrot_applications WHERE survey_token = ${escStr(token)}`,
      true
    );
    const app = rows && rows[0];
    if (!app) return Response.json({ state: "invalid" });
    if (app.survey_done_at) return Response.json({ state: "done" });
    const expiry = app.survey_expires_at ? new Date(app.survey_expires_at).getTime() : 0;
    if (!expiry || expiry < Date.now()) return Response.json({ state: "expired" });

    if (action === "get") {
      return Response.json({
        state: "ok",
        full_name: app.full_name,
        email: app.email,
        situation: app.situation || "",
        expires_at: app.survey_expires_at,
      });
    }

    // === Wypełnienie ankiety (nowa redakcja 18.11.2026) ===
    // Część A bez danych o zdrowiu; część B (wsparcie i zdrowie) tylko za osobną, dobrowolną zgodą (art. 9 ust. 2 lit. a RODO).
    const consentPaid = body.consent_paid === true;
    if (!consentPaid) bad("Potwierdź, że znasz cenę programu i zasady kwalifikacji.");
    const consentHealth = body.consent_health === true;

    const age = textField(body, "age", { max: 20, required: false });
    const returnOther = textField(body, "return_from_other", { max: 500, required: false });
    const situation = textField(body, "situation", { max: 5000 });
    const duration = textField(body, "duration", { max: 60 });
    const triedBefore = textField(body, "tried_before", { max: 5000, required: false });
    const goal = textField(body, "goal", { max: 5000 });
    const startKiedy = textField(body, "start_kiedy", { max: 60 });
    const weeklyTime = textField(body, "weekly_time", { max: 60 });
    const investment = textField(body, "investment", { max: 60 });
    const decyzja = textField(body, "decyzja", { max: 80 });
    const anythingElse = textField(body, "anything_else", { max: 5000, required: false });
    const source = textField(body, "source", { max: 60, required: false });
    const contactPref = textField(body, "contact_pref", { max: 20, required: false });
    // Dane o zdrowiu zapisujemy wyłącznie przy zgodzie; bez niej pola są czyszczone.
    const therapySupport = consentHealth ? textField(body, "therapy_support", { max: 40, required: false }) : null;
    const zdrowie = consentHealth ? textField(body, "zdrowie_uwagi", { max: 3000, required: false }) : null;

    const returnFrom = list(body.return_from);
    if (!returnFrom.length) bad("Wybierz co najmniej jedną odpowiedź w pytaniu o obszar pracy.");
    const oczekiwania = list(body.oczekiwania);
    if (!oczekiwania.length) bad("Wybierz co najmniej jedną odpowiedź w pytaniu o oczekiwania.");

    const urgent = isUrgent(situation, triedBefore, goal, anythingElse, returnOther, zdrowie || "");

    const updated = await runSql(
      base44,
      `UPDATE public.powrot_applications SET
         age = ${esc(age)}, return_from = ${jsonb(returnFrom)}, return_from_other = ${esc(returnOther)},
         situation = ${esc(situation)}, duration = ${esc(duration)}, tried_before = ${esc(triedBefore)},
         goal = ${esc(goal)}, oczekiwania = ${jsonb(oczekiwania)}, start_kiedy = ${esc(startKiedy)},
         weekly_time = ${esc(weeklyTime)}, investment = ${esc(investment)}, decyzja = ${esc(decyzja)},
         anything_else = ${esc(anythingElse)}, source = ${esc(source)}, contact_pref = ${esc(contactPref)},
         therapy_support = ${esc(therapySupport)}, zdrowie_uwagi = ${esc(zdrowie)},
         consent_rodo = TRUE, consent_paid = TRUE,
         consent_health = ${consentHealth ? "TRUE" : "FALSE"}, consent_health_at = ${consentHealth ? "now()" : "NULL"},
         pilne = ${urgent ? "TRUE" : "COALESCE(pilne, FALSE)"},
         status = CASE WHEN status IS NULL OR status IN ('nowe','ankieta_wyslana') THEN 'ankieta_wypelniona' ELSE status END,
         status_at = CASE WHEN status IS NULL OR status IN ('nowe','ankieta_wyslana') THEN now() ELSE status_at END,
         last_contact_at = now(),
         survey_done_at = now(), updated_date = now()
       WHERE survey_token = ${escStr(token)} AND survey_done_at IS NULL AND survey_expires_at > now()
       RETURNING id, full_name, email, status`
    );
    if (!Array.isArray(updated) || !updated.length)
      return Response.json({ error: "Ten link wygasł albo został już użyty." }, { status: 400 });
    await runSql(base44, `INSERT INTO public.powrot_log (application_id, kind, to_status, summary, actor)
      VALUES (${escStr(updated[0].id)}, 'status', ${escStr(updated[0].status)}, ${escStr(consentHealth ? "Ankieta wypełniona (z częścią o zdrowiu)" : "Ankieta wypełniona (bez części o zdrowiu)")}, 'kandydat')`).catch(() => {});

    const appId = updated[0].id;
    await loadAppUrl(base44).catch(() => {});
    waitUntil((async () => {
      if (urgent) { await notifyUrgent(base44); return; }
      const admin = await adminTo(base44).catch(() => null);
      if (!admin) return;
      const link = `${APP}/admin/powrot`;
      await sendMail(base44, {
        kind: "powrot_ankieta", ref: appId, to: admin, subject: "Wypełniona ankieta POWRÓT",
        html: wrap(`<p>Nowa wypełniona ankieta POWRÓT: ${escHtml(updated[0].full_name)}.</p><p>Odpowiedzi są tylko w panelu.</p><p><a style="color:#C9A24A" href="${link}">Otwórz zgłoszenie</a></p>`),
      }).catch(() => {});
    })());

    return Response.json({ state: "saved", pilne: urgent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
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