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
  ]
});