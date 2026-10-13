import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
const __dirname = path.dirname(fileURLToPath(import.meta.url))
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
// Szybki start strony (wydajność — PageSpeed):
// 1) czcionki (@font-face) w środku HTML zamiast osobnego pliku blokującego wyświetlanie,
// 2) wcześniejsze połączenie z serwerem zdjęć,
// 3) do premiery: na „/” i „/1-listopada” gość od razu widzi nagłówek strony i główne zdjęcie (gotowy HTML
//    z src/content/landingShell.html), zanim załaduje się aplikacja — React podmienia go identyczną treścią.
//    Po dacie premiery (PRE_END z src/lib/usePrelaunch.js) mechanizm wyłącza się sam.
//    Po zmianie nagłówka strony 1 listopada: odśwież plik poleceniem z docs/tech/landing-shell.mjs.
function exmFastStart() {
  const read = (f) => { try { return fs.readFileSync(path.resolve(__dirname, f), "utf8"); } catch { return ""; } };
  return {
    name: "exm-fast-start",
    transformIndexHtml(html) {
      let out = html;
      const fonts = read("public/fonts/fonts.css");
      if (fonts) out = out.replace('<link rel="stylesheet" href="/fonts/fonts.css" />', `<style>${fonts.replace(/\/\*[^*]*\*\//g, "").replace(/\s+/g, " ")}</style>`);
      out = out.replace('<link rel="preload" href="/fonts/cinzel-1.woff2"', '<link rel="preconnect" href="https://media.base44.com" />\n    <link rel="preload" href="/fonts/cinzel-1.woff2"');
      const shell = read("src/content/landingShell.html").trim();
      const end = (read("src/lib/usePrelaunch.js").match(/PRE_END = new Date\("([^"]+)"\)/) || [])[1];
      if (!shell || !end || !/<img [^>]*srcset=/.test(shell)) return out;
      const hero = (shell.match(/<img [^>]*srcset="[^"]+"[^>]*>/) || [])[0] || ""; // główne zdjęcie (z wersjami), nie logo
      const attr = (n) => (hero.match(new RegExp(` ${n}="([^"]+)"`)) || [])[1] || "";
      const cond = `(location.pathname==="/"||location.pathname==="/1-listopada")&&Date.now()<${Date.parse(end)}&&!localStorage.getItem("base44_access_token")`;
      const head = `<script>try{if(${cond}){var l=document.createElement("link");l.rel="preload";l.as="image";l.href=${JSON.stringify(attr("src"))};l.setAttribute("imagesrcset",${JSON.stringify(attr("srcset"))});l.setAttribute("imagesizes",${JSON.stringify(attr("sizes") || "100vw")});l.setAttribute("fetchpriority","high");document.head.appendChild(l)}}catch(e){}</script>`;
      const body = `<template id="exm-shell">${shell}</template>\n    <script>try{if(${cond}){var r=document.getElementById("root");r.appendChild(document.getElementById("exm-shell").content.cloneNode(true));r.querySelectorAll("[data-shell-until]").forEach(function(e){var t=e.getAttribute("data-shell-until");if(Date.now()>=Date.parse(/[zZ+]|-\\d\\d:\\d\\d$/.test(t)?t:t+"+02:00"))e.remove()})}}catch(e){}</script>`;
      return out.replace("</head>", `  ${head}\n  </head>`).replace('<div id="root"></div>', `<div id="root"></div>\n    ${body}`);
    },
  };
}

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
    exmFastStart(),
    exmJoinFallback(),
  ]
});