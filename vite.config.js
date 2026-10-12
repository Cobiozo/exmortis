import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { SITE_URL, OG_SPOTKANIE, OG_MARKA, metaMode } from './src/config/site.js'

// Wspólny nagłówek dla robotów: wstawiany przy publikacji wg src/config/site.js (bez og:url).
const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function exmMeta() {
  return {
    name: "exm-meta",
    transformIndexHtml(html) {
      const og = metaMode() === "spotkanie" ? OG_SPOTKANIE : OG_MARKA;
      const img = SITE_URL + og.img;
      const tags = [
        `<title>${esc(og.pageTitle)}</title>`,
        `<meta name="description" content="${esc(og.d)}" />`,
        `<meta property="og:site_name" content="exmortis" />`,
        `<meta property="og:locale" content="pl_PL" />`,
        `<meta property="og:type" content="website" />`,
        `<meta property="og:title" content="${esc(og.title)}" />`,
        `<meta property="og:description" content="${esc(og.d)}" />`,
        `<meta property="og:image" content="${img}" />`,
        `<meta property="og:image:width" content="1200" />`,
        `<meta property="og:image:height" content="630" />`,
        `<meta property="og:image:alt" content="${esc(og.alt)}" />`,
        `<meta name="twitter:card" content="summary_large_image" />`,
        `<meta name="twitter:title" content="${esc(og.title)}" />`,
        `<meta name="twitter:description" content="${esc(og.d)}" />`,
        `<meta name="twitter:image" content="${img}" />`,
        `<meta name="twitter:image:alt" content="${esc(og.alt)}" />`,
      ];
      return html.replace("<!--EXM_META-->", tags.join("\n    "));
    },
  };
}

// Dane awaryjne strony /dolacz: przy budowaniu (publikacji) pobierane z bazy przez publiczną listę spotkań,
// więc każda publikacja ma aktualną kopię bez ręcznej edycji. Brak sieci / błąd → zapisana kopia z src/content/joinFallbackData.js.
const FB_ID = "virtual:exm-join-fallback";
function exmJoinFallback() {
  let build = false;
  return {
    name: "exm-join-fallback",
    configResolved(c) { build = c.command === "build"; },
    resolveId(id) { return id === FB_ID ? "\0" + FB_ID : null; },
    async load(id) {
      if (id !== "\0" + FB_ID) return null;
      const saved = `export { FALLBACK_AT, FALLBACK_EVENTS } from "/src/content/joinFallbackData.js";`;
      if (!build || process.env.EXM_FALLBACK_OFFLINE === "1") return saved;
      try {
        const get = () => fetch(`${SITE_URL}/functions/eventsPublic`, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list" }), signal: AbortSignal.timeout(10000) });
        const r = await get().catch(() => get()); // drugie podejście po zimnym starcie funkcji
        if (!r.ok) throw new Error(String(r.status));
        const d = await r.json();
        const events = (d.upcoming || []).filter((e) => e.format === "Online" && ["Opublikowane", "Odwołane"].includes(e.status) && e.slug && e.start_datetime)
          .map((e) => ({ slug: e.slug, short_path: e.short_path || null, title: e.title, start_datetime: e.start_datetime,
            duration_minutes: Number(e.duration_minutes) || 60, open_minutes: Number(e.open_minutes) || 15 }));
        if (!Array.isArray(d.upcoming)) throw new Error("brak listy");
        return `export const FALLBACK_AT = ${JSON.stringify(new Date().toISOString())};\nexport const FALLBACK_EVENTS = ${JSON.stringify(events)};`;
      } catch (e) {
        this.warn(`Dane awaryjne /dolacz: użyta zapisana kopia (${e.message})`);
        return saved;
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
    exmMeta(),
    exmJoinFallback(),
  ]
});