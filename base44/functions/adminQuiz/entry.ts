import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, escStr, requireAdmin } from "../../shared/supabase.ts";

// Wyniki testu "Która śmierć jest Twoja?" dla panelu administratora:
// statystyki zbiorcze + pełna lista z filtrami.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    await requireAdmin(base44);
    const body = await req.json().catch(() => ({}));

    if (body.action === "stats") {
      const dominant = await runSql(
        base44,
        `SELECT dominant, COUNT(*)::int AS count
         FROM public.quiz_result
         GROUP BY dominant`,
        true
      );
      const stages = await runSql(
        base44,
        `SELECT stage, COUNT(*)::int AS count
         FROM public.quiz_result
         GROUP BY stage`,
        true
      );
      const total = await runSql(
        base44,
        `SELECT COUNT(*)::int AS total FROM public.quiz_result`,
        true
      );
      return Response.json({
        dominant,
        stages,
        total: total.length ? total[0].total : 0,
      });
    }

    if (body.action === "list") {
      const DOMINANTS = ["Mentalna", "Duchowa", "Życiowa", "Mieszana", "Żadna"];
      const STAGES = ["Śmierć", "Próg", "Powrót", "Inny"];
      const FORMS = ["Mężczyzna", "Kobieta"];
      const dateRe = /^\d{4}-\d{2}-\d{2}$/;

      const where = [];
      if (DOMINANTS.includes(body.dominant)) {
        where.push(`dominant = ${escStr(body.dominant)}`);
      }
      if (STAGES.includes(body.stage)) {
        where.push(`stage = ${escStr(body.stage)}`);
      }
      if (FORMS.includes(body.form_of_address)) {
        where.push(`form_of_address = ${escStr(body.form_of_address)}`);
      }
      if (typeof body.source === "string" && body.source.trim()) {
        where.push(`source = ${escStr(body.source.trim().slice(0, 50))}`);
      }
      if (dateRe.test(String(body.date_from))) {
        where.push(`created_at >= ${escStr(body.date_from)}::date`);
      }
      if (dateRe.test(String(body.date_to))) {
        where.push(`created_at < (${escStr(body.date_to)}::date + interval '1 day')`);
      }
      const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";

      const rows = await runSql(
        base44,
        `SELECT id, created_at, first_name, email, form_of_address, score_mental, score_spiritual, score_life,
                dominant, stage, source, newsletter_consent, open_answer,
                COALESCE((to_jsonb(q)->>'score_max')::int, 12) AS score_max
         FROM public.quiz_result q${whereSql}
         ORDER BY created_at DESC
         LIMIT 1000`,
        true
      );
      return Response.json({ rows });
    }

    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (error) {
    if (error && error.message === "FORBIDDEN") {
      return Response.json({ error: "Brak dostępu" }, { status: 403 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
}