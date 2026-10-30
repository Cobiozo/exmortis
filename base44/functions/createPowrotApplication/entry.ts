import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { waitUntil } from "base44:runtime";
import { runSql, esc, escStr, textField, emailField, clientIp } from "../../shared/supabase.ts";
import { ipAllowed, TOO_MANY } from "../../shared/rateLimit.ts";
import { isUrgent, notifyUrgent } from "../../shared/crisis.ts";
import { loadAppUrl, APP_URL as APP } from "../../shared/settings.ts";
import { sendMail, adminTo } from "../../shared/smtp.ts";
import { wrap, escHtml, num1to10, list, jsonb } from "../../shared/powrotSurvey.ts";

const HELP = `<p style="font-size:18px;color:#C9A24A;line-height:1.7"><b>116 123</b> · <b>800 70 2222</b> (całą dobę, bezpłatnie) · <b>112</b></p>`;

// Nowe kolumny formularza kwalifikacyjnego (tele jest zgodne z encją PowrotApplication).
const COLUMNS = [
  ["age", "text"],
  ["return_from", "jsonb"],
  ["return_from_other", "text"],
  ["situation", "text"],
  ["duration", "text"],
  ["affected_areas", "jsonb"],
  ["tried_before", "text"],
  ["therapy_support", "text"],
  ["goal", "text"],
  ["obstacle", "text"],
  ["readiness", "integer"],
  ["weekly_time", "text"],
  ["work_form", "text"],
  ["investment", "text"],
  ["anything_else", "text"],
  ["source", "text"],
  ["contact_pref", "text"],
  ["consent_rodo", "boolean"],
  ["consent_paid", "boolean"],
  ["consent_adult", "boolean"],
];
let adultCol = false;
// Znacznik „pilne" na zgłoszeniu; kolumna zakładana raz na instancję.
let pilneCol = false;
async function ensurePilne(base44) {
  if (pilneCol) return;
  const has = await runSql(base44, `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'powrot_applications' AND column_name = 'pilne'`, true);
  if (!(Array.isArray(has) && has.length)) await runSql(base44, `ALTER TABLE public.powrot_applications ADD COLUMN IF NOT EXISTS pilne boolean`);
  pilneCol = true;
}

// wrap, escHtml, num1to10, list i jsonb — wspólne z ankietą (../../shared/powrotSurvey.ts), żeby oba etapy pisały tak samo.

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const fullName = textField(body, "full_name", { max: 200 });
    const phone = textField(body, "phone", { max: 50 });
    const email = emailField(body);

    const age = textField(body, "age", { max: 20, required: false });
    const returnOther = textField(body, "return_from_other", { max: 500, required: false });
    // Etap 1: krótkie zgłoszenie — „co jest dla Ciebie ważne właśnie teraz” trafia do kolumny situation.
    const situation = textField(body, "situation", { max: 5000 });
    const duration = textField(body, "duration", { max: 60, required: false });
    const triedBefore = textField(body, "tried_before", { max: 5000, required: false });
    const therapySupport = textField(body, "therapy_support", { max: 40, required: false });
    const goal = textField(body, "goal", { max: 5000, required: false });
    const obstacle = textField(body, "obstacle", { max: 5000, required: false });
    const weeklyTime = textField(body, "weekly_time", { max: 40, required: false });
    const workForm = textField(body, "work_form", { max: 60, required: false });
    const investment = textField(body, "investment", { max: 60, required: false });
    const anythingElse = textField(body, "anything_else", { max: 5000, required: false });
    const source = textField(body, "source", { max: 60, required: false });
    const contactPref = textField(body, "contact_pref", { max: 20, required: false });

    const readiness = num1to10(body.readiness);
    const returnFrom = list(body.return_from);
    const affectedAreas = list(body.affected_areas);
    const consentRodo = body.consent_rodo === true;
    const consentPaid = body.consent_paid === true;
    const consentAdult = body.consent_adult === true;
    // Zgody wymagane także po stronie serwera (formularz w przeglądarce można obejść).
    // Etap 1: tylko zgoda na kontakt i pełnoletność — zgoda na płatność i regulamin są w ankiecie.
    if (!consentRodo || !consentAdult) return Response.json({ error: "Zaznacz wymagane zgody (w tym potwierdzenie ukończenia 18 lat)." }, { status: 400 });
    if (!adultCol) { await runSql(base44, `ALTER TABLE public.powrot_applications ADD COLUMN IF NOT EXISTS consent_adult boolean`); adultCol = true; }
    const pilne = isUrgent(situation, triedBefore, goal, obstacle, anythingElse, returnOther);
    await ensurePilne(base44);

    // Limit zgłoszeń z jednego połączenia (ochrona przed zasypaniem formularza).
    if (!(await ipAllowed(base44, clientIp(req), "powrot", 5, 3600000))) return Response.json({ error: TOO_MANY }, { status: 429 });

    const rows = await runSql(
      base44,
      `INSERT INTO public.powrot_applications
         (id, full_name, phone, email, age, return_from, return_from_other, situation,
          duration, affected_areas, tried_before, therapy_support, goal, obstacle,
          readiness, weekly_time, work_form, investment, anything_else, source,
          contact_pref, consent_rodo, consent_paid, consent_adult, pilne, created_date, updated_date)
       VALUES
         (gen_random_uuid()::text, ${esc(fullName)}, ${esc(phone)}, ${esc(email)}, ${esc(age)},
          ${jsonb(returnFrom)}, ${esc(returnOther)}, ${esc(situation)}, ${esc(duration)},
          ${jsonb(affectedAreas)}, ${esc(triedBefore)}, ${esc(therapySupport)}, ${esc(goal)},
          ${esc(obstacle)}, ${esc(readiness)}, ${esc(weeklyTime)}, ${esc(workForm)},
          ${esc(investment)}, ${esc(anythingElse)}, ${esc(source)}, ${esc(contactPref)},
          ${consentRodo}, ${consentPaid}, ${consentAdult}, ${esc(pilne)}, now(), now())
       RETURNING id`
    );

    // Potwierdzenie dla kandydata i powiadomienie do mnie — jak w zgłoszeniu do podcastu (kolejka, bez blokowania odpowiedzi).
    const appId = rows && rows[0] ? rows[0].id : null;
    await loadAppUrl(base44).catch(() => {});
    waitUntil((async () => {
      const admin = await adminTo(base44).catch(() => null);
      const link = `${APP}/admin/powrot`;
      if (pilne) {
        await sendMail(base44, { kind: "powrot", ref: appId, to: email, subject: "Dziękuję za Twoją wiadomość",
          html: wrap(`<p>Dziękuję za tę wiadomość. Przeczytam Twoje zgłoszenie osobiście.</p><p>Jeśli jest Ci teraz bardzo ciężko, nie czekaj na moją odpowiedź. Zadzwoń teraz:</p>${HELP}<p>Twoja historia poczeka. Ty jesteś ważniejszy(-a).</p><p>Dawid, exmortis</p>`) }).catch(() => {});
        await notifyUrgent(base44);
      } else {
        await sendMail(base44, { kind: "powrot", ref: appId, to: email, subject: "Twoje zgłoszenie POWRÓT",
          html: wrap(`<p>Dziękuję za zaufanie. Każdy powrót zaczyna się od pierwszego kroku — właśnie został zrobiony. Przeczytam Twoje zgłoszenie osobiście i odezwę się w ciągu kilku dni, żeby umówić rozmowę.</p><p>Dawid, exmortis</p>`) }).catch(() => {});
        if (admin) await sendMail(base44, { kind: "powrot", ref: appId, to: admin, subject: "Nowe zgłoszenie kwalifikacyjne POWRÓT",
          html: wrap(`<p>Przyszło nowe zgłoszenie kwalifikacyjne od ${escHtml(fullName)} (${escHtml(email)}).</p><p><a style="color:#C9A24A" href="${link}">Otwórz panel</a></p>`) }).catch(() => {});
      }
    })());

    return Response.json({ ok: true, id: appId, pilne });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}