import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, requireAdmin } from "../../shared/supabase.ts";

// Statystyki testu "Która śmierć jest Twoja?" dla panelu administratora.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    await requireAdmin(base44);
    const body = await req.json().catch(() => ({}));

    if (body.action !== "stats") {
      return Response.json({ error: "Nieznana akcja" }, { status: 400 });
    }

    const counts = await runSql(
      base44,
      `SELECT dominant, COUNT(*)::int AS count
       FROM public.quiz_result
       GROUP BY dominant`,
      true
    );
    const total = await runSql(
      base44,
      `SELECT COUNT(*)::int AS total FROM public.quiz_result`,
      true
    );
    const recent = await runSql(
      base44,
      `SELECT id, email, first_name, score_mental, score_spiritual, score_life, dominant, created_at
       FROM public.quiz_result
       ORDER BY created_at DESC
       LIMIT 50`,
      true
    );

    return Response.json({
      counts,
      total: total.length ? total[0].total : 0,
      recent,
    });
  } catch (error) {
    if (error && error.message === "FORBIDDEN") {
      return Response.json({ error: "Brak dostępu" }, { status: 403 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
}