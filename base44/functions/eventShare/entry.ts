import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, escStr } from "../../shared/supabase.ts";
import { plWhen, APP_URL } from "../../shared/events.ts";
import { loadAppUrl } from "../../shared/settings.ts";

// Link do udostępniania spotkania: HTML z og:image/og:title/og:description
// renderowany na serwerze (roboty Facebooka nie uruchamiają JS),
// a człowiek jest od razu przekierowany na /spotkania/[slug].
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export default async function (req) {
  const slug = (new URL(req.url).searchParams.get("slug") || "").slice(0, 200);
  const base44 = createClientFromRequest(req);
  await loadAppUrl(base44);
  const rows = slug
    ? await runSql(base44, `SELECT title, subtitle, start_datetime, cover, cover_image FROM public.events
        WHERE slug = ${escStr(slug)} AND status IN ('Opublikowane','Odwołane')`, true).catch(() => [])
    : [];
  const ev = rows?.[0];
  const target = ev ? `${APP_URL}/spotkania/${encodeURIComponent(slug)}` : `${APP_URL}/spotkania`;
  let c = ev?.cover;
  if (typeof c === "string") { try { c = JSON.parse(c); } catch { c = null; } }
  const title = ev ? `${ev.title} · exmortis` : "Spotkania · exmortis";
  const desc = ev ? [ev.start_datetime && plWhen(ev.start_datetime), ev.subtitle].filter(Boolean).join(" — ") : "Spotkania exmortis.";
  const img = c?.crops?.og || ev?.cover_image || "";
  const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(target)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
${img ? `<meta property="og:image" content="${esc(img)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(c?.alt || ev?.title)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${esc(target)}">
<meta http-equiv="refresh" content="0;url=${esc(target)}">
</head><body style="background:#0A0A0B;color:#E2E2E2;font-family:Georgia,serif">
<p><a href="${esc(target)}" style="color:#C9A24A">${esc(ev?.title || "Spotkania exmortis")}</a></p></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
}