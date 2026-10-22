import { createClientFromRequest } from "../_shared/compat.ts";
import { runSql, escStr } from "../_shared/supabase.ts";
import { plWhen, APP_URL } from "../_shared/events.ts";
import { loadAppUrl } from "../_shared/settings.ts";

// Link do udostępniania spotkania: HTML z og:image/og:title/og:description
// renderowany na serwerze (roboty Facebooka nie uruchamiają JS),
// a człowiek jest od razu przekierowany na /spotkania/[slug].
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const handler = async function (req) {
  const slug = (new URL(req.url).searchParams.get("slug") || "").slice(0, 200);
  const base44 = createClientFromRequest(req);
  await loadAppUrl(base44);
  const rows = slug
    ? await runSql(base44, `SELECT title, subtitle, start_datetime, cover, cover_image FROM public.events
        WHERE slug = ${escStr(slug)} AND status IN ('Opublikowane','Odwołane')`, true).catch(() => [])
    : [];
  const ev = rows?.[0];
  // Źródło (facebook, whatsapp, plakat…) przechodzi dalej — zapisy pokazują, skąd ktoś przyszedł.
  const src = (new URL(req.url).searchParams.get("src") || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30);
  const clean = ev ? `${APP_URL}/spotkania/${encodeURIComponent(slug)}` : `${APP_URL}/spotkania`;
  const target = clean + (src ? `?src=${src}` : "");
  let c = ev?.cover;
  if (typeof c === "string") { try { c = JSON.parse(c); } catch { c = null; } }
  const title = ev ? `${ev.title} · exmortis` : "Spotkania · exmortis";
  const desc = ev ? [ev.start_datetime && plWhen(ev.start_datetime), ev.subtitle].filter(Boolean).join(" — ") : "Spotkania exmortis.";
  const img = c?.crops?.og || ev?.cover_image || "";
  const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(clean)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
${img ? `<meta property="og:image" content="${esc(img)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(c?.alt || ev?.title)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${esc(clean)}">
<meta http-equiv="refresh" content="0;url=${esc(target)}">
</head><body style="background:#0A0A0B;color:#E2E2E2;font-family:Georgia,serif">
<p><a href="${esc(target)}" style="color:#C9A24A">${esc(ev?.title || "Spotkania exmortis")}</a></p></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
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
