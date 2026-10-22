import { createClientFromRequest } from "../_shared/compat.ts";
import { runSql, escStr, requireStaff as requireAdmin } from "../_shared/supabase.ts";

// Administracja Minutnikiem ciszy: pliki audio (ustawienia) i anonimowe statystyki.
function uriVal(v) {
  if (typeof v !== "string" || v.trim() === "") return "NULL";
  return escStr(v.trim().slice(0, 1000));
}

const handler = async function (req) {
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
      await runSql(base44, `ALTER TABLE public.silence_sessions ADD COLUMN IF NOT EXISTS background text`);
      const backgrounds = await runSql(
        base44,
        `SELECT COALESCE(background, 'Czerń') AS background, COUNT(*)::int AS started,
                SUM(CASE WHEN completed THEN 1 ELSE 0 END)::int AS completed
         FROM public.silence_sessions
         WHERE created_at >= now() - interval '30 days'
         GROUP BY 1 ORDER BY 2 DESC`,
        true
      );
      return Response.json({ rows, silent: silent?.[0]?.n || 0, backgrounds: backgrounds || [] });
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
