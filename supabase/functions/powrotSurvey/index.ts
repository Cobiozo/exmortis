import { createClientFromRequest } from "../_shared/compat.ts";
import { waitUntil } from "../_shared/shim.ts";
import { runSql, esc, escStr, textField, clientIp } from "../_shared/supabase.ts";
import { ipAllowed, TOO_MANY } from "../_shared/rateLimit.ts";
import { isUrgent, notifyUrgent } from "../_shared/crisis.ts";
import { loadAppUrl, APP_URL as APP } from "../_shared/settings.ts";
import { sendMail, adminTo } from "../_shared/smtp.ts";
import { ensureSurveyColumns, tokenOk, wrap, escHtml, bad, num1to10, list, jsonb } from "../_shared/powrotSurvey.ts";

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

    // === Wypełnienie ankiety: te same pytania co dotąd, zgody na końcu ===
    const consentHealth = body.consent_health === true;
    const consentTerms = body.consent_terms === true;
    const consentPaid = body.consent_paid === true;
    if (!consentHealth || !consentTerms || !consentPaid) bad("Zaznacz wymagane zgody.");

    const age = textField(body, "age", { max: 20, required: false });
    const returnOther = textField(body, "return_from_other", { max: 500, required: false });
    const situation = textField(body, "situation", { max: 5000 });
    const duration = textField(body, "duration", { max: 60 });
    const triedBefore = textField(body, "tried_before", { max: 5000, required: false });
    const therapySupport = textField(body, "therapy_support", { max: 40, required: false });
    const goal = textField(body, "goal", { max: 5000 });
    const obstacle = textField(body, "obstacle", { max: 5000, required: false });
    const weeklyTime = textField(body, "weekly_time", { max: 40 });
    const workForm = textField(body, "work_form", { max: 60, required: false });
    const investment = textField(body, "investment", { max: 60 });
    const anythingElse = textField(body, "anything_else", { max: 5000, required: false });
    const source = textField(body, "source", { max: 60, required: false });
    const contactPref = textField(body, "contact_pref", { max: 20, required: false });

    const readiness = num1to10(body.readiness);
    if (readiness == null) bad("Wybierz ocenę gotowości od 1 do 10.");
    const returnFrom = list(body.return_from);
    if (!returnFrom.length) bad("Wybierz co najmniej jedną odpowiedź w pytaniu „Z czego dziś wracasz?”.");
    const affectedAreas = list(body.affected_areas);

    const urgent = isUrgent(situation, triedBefore, goal, obstacle, anythingElse, returnOther);

    const updated = await runSql(
      base44,
      `UPDATE public.powrot_applications SET
         age = ${esc(age)}, return_from = ${jsonb(returnFrom)}, return_from_other = ${esc(returnOther)},
         situation = ${esc(situation)}, duration = ${esc(duration)}, affected_areas = ${jsonb(affectedAreas)},
         tried_before = ${esc(triedBefore)}, therapy_support = ${esc(therapySupport)}, goal = ${esc(goal)},
         obstacle = ${esc(obstacle)}, readiness = ${esc(readiness)}, weekly_time = ${esc(weeklyTime)},
         work_form = ${esc(workForm)}, investment = ${esc(investment)}, anything_else = ${esc(anythingElse)},
         source = ${esc(source)}, contact_pref = ${esc(contactPref)},
         consent_rodo = TRUE, consent_paid = TRUE, consent_health = TRUE, consent_health_at = now(),
         pilne = ${urgent ? "TRUE" : "COALESCE(pilne, FALSE)"},
         survey_done_at = now(), updated_date = now()
       WHERE survey_token = ${escStr(token)} AND survey_done_at IS NULL AND survey_expires_at > now()
       RETURNING id, full_name, email`
    );
    if (!Array.isArray(updated) || !updated.length)
      return Response.json({ error: "Ten link wygasł albo został już użyty." }, { status: 400 });

    const appId = updated[0].id;
    await loadAppUrl(base44).catch(() => {});
    waitUntil((async () => {
      if (urgent) { await notifyUrgent(base44); return; }
      const admin = await adminTo(base44).catch(() => null);
      if (!admin) return;
      const link = `${APP}/admin/powrot`;
      await sendMail(base44, {
        kind: "powrot_ankieta", ref: appId, to: admin, subject: "Wypełniona ankieta POWRÓT",
        html: wrap(`<p>${escHtml(updated[0].full_name)} (${escHtml(updated[0].email)}) wypełnił(-ęła) pełną ankietę przed rozmową.</p><p><a style="color:#C9A24A" href="${link}">Otwórz zgłoszenie w panelu</a></p>`),
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