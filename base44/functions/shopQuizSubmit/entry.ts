import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, escStr, emailField, textField } from "../../shared/supabase.ts";

// Publiczne przesłanie testu "Która śmierć jest Twoja?": zapis wyniku + opcjonalny zapis na Listy powrotu.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const email = emailField(body);
    const firstName = textField(body, "first_name", { max: 200, required: false });

    const answers = body.answers;
    if (
      !Array.isArray(answers) ||
      answers.length !== 12 ||
      answers.some((a) => ![0, 1, 2, 3].includes(Number(a)))
    ) {
      throw new Error("Niepoprawne odpowiedzi testu");
    }

    const scores = { mentalna: 0, duchowa: 0, zyciowa: 0 };
    answers.forEach((a, i) => {
      const v = Number(a);
      if (i < 4) scores.mentalna += v;
      else if (i < 8) scores.duchowa += v;
      else scores.zyciowa += v;
    });

    const ranked = [
      ["Mentalna", scores.mentalna],
      ["Duchowa", scores.duchowa],
      ["Życiowa", scores.zyciowa],
    ].sort((a, b) => b[1] - a[1]);
    let dominant = ranked[0][0];
    if (ranked[0][1] - ranked[1][1] <= 2) dominant = "Mieszana";

    await runSql(
      base44,
      `INSERT INTO public.quiz_result (email, first_name, score_mental, score_spiritual, score_life, dominant)
       VALUES (${escStr(email)}, ${firstName === null ? "NULL" : escStr(firstName)}, ${scores.mentalna}, ${scores.duchowa}, ${scores.zyciowa}, ${escStr(dominant)})`
    );

    if (body.newsletter_optin === true) {
      await runSql(
        base44,
        `INSERT INTO public.subscribers (id, email, name)
         VALUES (gen_random_uuid()::text, ${escStr(email)}, ${firstName === null ? "NULL" : escStr(firstName)})
         ON CONFLICT (email) DO NOTHING`
      );
    }

    return Response.json({
      dominant,
      scores: { mentalna: scores.mentalna, duchowa: scores.duchowa, zyciowa: scores.zyciowa },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}