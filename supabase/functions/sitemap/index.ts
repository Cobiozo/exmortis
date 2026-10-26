import { createClientFromRequest } from "../_shared/compat.ts";
import { runSql } from "../_shared/supabase.ts";
import { loadAppUrl } from "../_shared/settings.ts";

// Mapa strony dla wyszukiwarek (https://exmortis.pl/functions/sitemap, wpisana w robots.txt).
// Strony stałe + produkty Skarbca + opublikowane spotkania + opublikowane odcinki podcastu. Pamięć 1 h w instancji.
const STATIC = [
  ["/", "weekly", "1.0"], ["/1-listopada", "daily", "0.9"], ["/o-mnie", "monthly", "0.8"], ["/powrot", "monthly", "0.8"],
  ["/skarbiec", "weekly", "0.8"], ["/spotkania", "weekly", "0.7"], ["/glos", "weekly", "0.6"], ["/test", "monthly", "0.6"],
  ["/obok", "monthly", "0.5"], ["/cisza", "monthly", "0.5"], ["/kontakt", "yearly", "0.4"],
  ["/regulamin", "yearly", "0.2"], ["/polityka-prywatnosci", "yearly", "0.2"], ["/polityka-cookies", "yearly", "0.2"], ["/odstapienie", "yearly", "0.2"],
];
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
let CACHE: { xml: string; at: number } | null = null;

const handler = async function (req) {
  try {
    if (CACHE && Date.now() - CACHE.at < 3600000) return xmlResponse(CACHE.xml);
    const base44 = createClientFromRequest(req);
    const SITE = String(await loadAppUrl(base44)).replace(/\/+$/, "");
    const [products, events, episodes] = await Promise.all([
      runSql(base44, `SELECT slug, updated_date FROM public.products WHERE active = TRUE AND COALESCE(status, 'dostępny') <> 'ukryty' AND slug IS NOT NULL AND COALESCE(checkout_url, '') = '' ORDER BY sort_order NULLS LAST LIMIT 300`, true).catch(() => []),
      runSql(base44, `SELECT e.slug, COALESCE(to_jsonb(e)->>'updated_at', to_jsonb(e)->>'updated_date', to_jsonb(e)->>'created_at') AS updated_at FROM public.events e WHERE e.status = 'Opublikowane' AND e.slug IS NOT NULL AND e.start_datetime > now() - interval '30 days' LIMIT 200`, true).catch(() => []),
      base44.asServiceRole.entities.PodcastEpisode.filter({ status: "opublikowany" }, "-publikacja", 300).catch(() => []),
    ]);
    const urls = [
      ...STATIC.map(([p, f, pr]) => ({ loc: SITE + p, changefreq: f, priority: pr })),
      ...products.map((p) => ({ loc: `${SITE}/skarbiec/${p.slug}`, lastmod: day(p.updated_date), changefreq: "weekly", priority: "0.6" })),
      ...events.filter((e) => e.slug !== "ze-smierci-o-powrotach-o-ktorych-swiat-nie-mowi")
        .map((e) => ({ loc: `${SITE}/spotkania/${e.slug}`, lastmod: day(e.updated_at), changefreq: "weekly", priority: "0.5" })),
      ...episodes.filter((e) => e.slug).map((e) => ({ loc: `${SITE}/glos/${e.slug}`, lastmod: day(e.updated_date || e.publikacja), changefreq: "monthly", priority: "0.5" })),
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) =>
      `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}<changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join("\n")}\n</urlset>\n`;
    CACHE = { xml, at: Date.now() };
    return xmlResponse(xml);
  } catch (e) {
    console.error(e);
    return new Response("<?xml version=\"1.0\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"></urlset>", { status: 200, headers: { "Content-Type": "application/xml; charset=utf-8" } });
  }
}

function xmlResponse(xml) {
  return new Response(xml, { status: 200, headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
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