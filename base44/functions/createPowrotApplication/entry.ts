import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, esc, escStr, textField, emailField, clientIp } from "../../shared/supabase.ts";
import { ipAllowed, TOO_MANY } from "../../shared/rateLimit.ts";

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

const num1to10 = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(1, Math.min(10, Math.round(n))) : null;
};

const list = (v) => (Array.isArray(v) ? v.map((s) => String(s)).slice(0, 20) : []);

const jsonb = (v) => `${escStr(JSON.stringify(v))}::jsonb`;

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const fullName = textField(body, "full_name", { max: 200 });
    const phone = textField(body, "phone", { max: 50 });
    const email = emailField(body);

    const age = textField(body, "age", { max: 20, required: false });
    const returnOther = textField(body, "return_from_other", { max: 500, required: false });
    const situation = textField(body, "situation", { max: 5000, required: false });
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
    if (!consentRodo || !consentPaid || !consentAdult) return Response.json({ error: "Zaznacz wymagane zgody (w tym potwierdzenie ukończenia 18 lat)." }, { status: 400 });
    if (!adultCol) { await runSql(base44, `ALTER TABLE public.powrot_applications ADD COLUMN IF NOT EXISTS consent_adult boolean`); adultCol = true; }

    // Limit zgłoszeń z jednego połączenia (ochrona przed zasypaniem formularza).
    if (!(await ipAllowed(base44, clientIp(req), "powrot", 5, 3600000))) return Response.json({ error: TOO_MANY }, { status: 429 });

    const rows = await runSql(
      base44,
      `INSERT INTO public.powrot_applications
         (id, full_name, phone, email, age, return_from, return_from_other, situation,
          duration, affected_areas, tried_before, therapy_support, goal, obstacle,
          readiness, weekly_time, work_form, investment, anything_else, source,
          contact_pref, consent_rodo, consent_paid, consent_adult, created_date, updated_date)
       VALUES
         (gen_random_uuid()::text, ${esc(fullName)}, ${esc(phone)}, ${esc(email)}, ${esc(age)},
          ${jsonb(returnFrom)}, ${esc(returnOther)}, ${esc(situation)}, ${esc(duration)},
          ${jsonb(affectedAreas)}, ${esc(triedBefore)}, ${esc(therapySupport)}, ${esc(goal)},
          ${esc(obstacle)}, ${esc(readiness)}, ${esc(weeklyTime)}, ${esc(workForm)},
          ${esc(investment)}, ${esc(anythingElse)}, ${esc(source)}, ${esc(contactPref)},
          ${consentRodo}, ${consentPaid}, ${consentAdult}, now(), now())
       RETURNING id`
    );

    return Response.json({ ok: true, id: rows && rows[0] ? rows[0].id : null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}