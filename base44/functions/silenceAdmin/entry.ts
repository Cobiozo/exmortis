import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, requireAdmin } from "../../shared/supabase.ts";

// Administracja Minutnikiem ciszy: pliki audio (ustawienia) i anonimowe statystyki.
function uriVal(v) {
  if (typeof v !== "string" || v.trim() === "") return "NULL";
  return `$q$${v.trim().slice(0, 1000)}$q$`;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    await requireAdmin(base44);
    const body = await req.json().catch(() => ({}));

    if (body.action === "get") {
      const rows = await runSql(
        base44,
        `SELECT intro_uri, outro_uri, background_uri
         FROM public.silence_settings
         WHERE id = 1`,
        true
      );
      return Response.json({
        settings: rows && rows[0]
          ? rows[0]
          : { intro_uri: null, outro_uri: null, background_uri: null },
      });
    }

    if (body.action === "save") {
      await runSql(
        base44,
        `UPDATE public.silence_settings SET
           intro_uri = ${uriVal(body.intro_uri)},
           outro_uri = ${uriVal(body.outro_uri)},
           background_uri = ${uriVal(body.background_uri)},
           updated_date = now()
         WHERE id = 1`
      );
      return Response.json({ ok: true });
    }

    if (body.action === "stats30") {
      const [rows, silent] = await Promise.all([
        runSql(
          base44,
          `SELECT duration_minutes, COALESCE(soundtrack, '(bez muzyki)') AS soundtrack,
                  COUNT(*)::int AS started,
                  SUM(CASE WHEN completed THEN 1 ELSE 0 END)::int AS completed
           FROM public.silence_sessions
           WHERE created_at >= now() - interval '30 days'
           GROUP BY 1, 2 ORDER BY 1, 3 DESC`,
          true
        ),
        runSql(
          base44,
          `SELECT COUNT(*)::int AS n FROM public.silence_sessions
           WHERE created_at >= now() - interval '30 days' AND COALESCE(with_sound, false) = false`,
          true
        ),
      ]);
      return Response.json({ rows, silent: silent?.[0]?.n || 0 });
    }

    if (body.action === "stats") {
      const [totals, durations, days, weeks, sources] = await Promise.all([
        runSql(
          base44,
          `SELECT COUNT(*)::int AS sessions,
                  SUM(CASE WHEN completed THEN 1 ELSE 0 END)::int AS completed
           FROM public.silence_sessions`,
          true
        ),
        runSql(
          base44,
          `SELECT duration_minutes, COUNT(*)::int AS count,
                  SUM(CASE WHEN completed THEN 1 ELSE 0 END)::int AS completed
           FROM public.silence_sessions
           GROUP BY duration_minutes
           ORDER BY duration_minutes ASC`,
          true
        ),
        runSql(
          base44,
          `SELECT to_char(created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS day,
                  COUNT(*)::int AS count
           FROM public.silence_sessions
           WHERE created_at >= now() - interval '30 days'
           GROUP BY 1
           ORDER BY 1 DESC`,
          true
        ),
        runSql(
          base44,
          `SELECT to_char(date_trunc('week', created_at AT TIME ZONE 'Europe/Warsaw'), 'YYYY-MM-DD') AS week,
                  COUNT(*)::int AS count
           FROM public.silence_sessions
           GROUP BY 1
           ORDER BY 1 DESC
           LIMIT 12`,
          true
        ),
        runSql(
          base44,
          `SELECT COALESCE(source, '(bez źródła)') AS source, COUNT(*)::int AS count
           FROM public.silence_sessions
           GROUP BY 1
           ORDER BY count DESC`,
          true
        ),
      ]);
      return Response.json({
        totals: totals[0] || { sessions: 0, completed: 0 },
        durations,
        days,
        weeks,
        sources,
      });
    }

    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (error) {
    if (error && error.message === "FORBIDDEN") {
      return Response.json({ error: "Brak dostępu" }, { status: 403 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
}