import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
const __dirname = path.dirname(fileURLToPath(import.meta.url))
import { SITE_URL, OG_SPOTKANIE, OG_MARKA, metaMode } from './src/config/site.js'
import { criticalCss } from './src/config/criticalCss.js'
import portableBuild from './src/config/portableBuild.js'

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
      const savedPath = path.resolve(__dirname, "src/content/joinFallbackData.js").replace(/\\/g, "/");
      const saved = `export { FALLBACK_AT, FALLBACK_EVENTS } from ${JSON.stringify(savedPath)};`;
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
      const cond = `(location.pathname==="/"||location.pathname==="/1-listopada")&&Date.now()<${Date.parse(end)}&&!localStorage.getItem("base44_access_token")&&!localStorage.getItem("token")&&!/[?&]access_token=/.test(location.search)`;
      const head = `<script>try{if(${cond}){var l=document.createElement("link");l.rel="preload";l.as="image";l.href=${JSON.stringify(attr("src"))};l.setAttribute("imagesrcset",${JSON.stringify(attr("srcset"))});l.setAttribute("imagesizes",${JSON.stringify(attr("sizes") || "100vw")});l.setAttribute("fetchpriority","high");document.head.appendChild(l)}}catch(e){}</script>`;
      // Powłoka leży NAD aplikacją (warstwa fixed poza #root), bo React przy starcie czyści #root i przez chwilę pokazuje
      // pusty ekran ładowania — wtedy główne zdjęcie znikało i malowało się drugi raz po ~2 s (LCP). Warstwa znika, gdy
      // aplikacja narysuje to samo zdjęcie (albo najpóźniej po 5 s); przewinięcie przechodzi na stronę pod spodem.
      // Warstwa znika dopiero, gdy jej własne zdjęcie jest już zdekodowane i namalowane (decode + 2 klatki) — inaczej
      // przy szybkim łączu aplikacja malowała zdjęcie pierwsza i to ono liczyło się jako LCP.
      // Klucz pliku zdjęcia (np. „6af0c5c2f_generated_image”) — po nim warstwa rozpoznaje to samo zdjęcie w aplikacji.
      const heroKey = (attr("src").match(/\/([0-9a-f]{6,}_[^/?.]+)\.(?:png|jpe?g|webp)/i) || [])[1] || "";
      const release = `function(){var o=document.getElementById("exm-shell-root");if(!o)return;var y=o.scrollTop;o.remove();document.documentElement.style.overflow="";if(y)window.scrollTo(0,y)}`;
      const body = `<template id="exm-shell">${shell}</template>\n    <script>try{if(${cond}){var o=document.createElement("div");o.id="exm-shell-root";o.style.cssText="position:fixed;inset:0;z-index:45;overflow-y:auto;background:#0A0A0B;-webkit-overflow-scrolling:touch";o.appendChild(document.getElementById("exm-shell").content.cloneNode(true));o.querySelectorAll("[data-shell-until]").forEach(function(e){var t=e.getAttribute("data-shell-until");if(Date.now()>=Date.parse(/[zZ+]|-\\d\\d:\\d\\d$/.test(t)?t:t+"+02:00"))e.remove()});document.body.appendChild(o);document.documentElement.style.overflow="hidden";var rel=${release},src=${JSON.stringify(attr("src"))},done=false,key=${JSON.stringify(heroKey)};var chk=function(){if(done)return;var i=null,im=document.querySelectorAll("#root img");for(var k=0;k<im.length;k++){var a=im[k].getAttribute("src")||"";if(key&&a.indexOf(key)>-1){i=im[k];break}}if(i&&i.complete&&i.naturalWidth){done=true;mo.disconnect();var go2=function(){requestAnimationFrame(function(){requestAnimationFrame(rel)})},si=o.querySelector("img[srcset]");if(si&&si.decode)si.decode().then(go2,go2);else go2()}};var mo=new MutationObserver(chk);mo.observe(document.getElementById("root"),{childList:true,subtree:true,attributes:true,attributeFilter:["src"]});document.addEventListener("load",chk,true);setTimeout(function(){done=true;mo.disconnect();rel()},5000)}}catch(e){}</script>`;
      // Skrypt podający preload zdjęcia hero — jak najwcześniej w head (przed skryptami i dużym CSS),
      // żeby na wolnym łączeniu obraz startował zanim przeglądarka dojdzie do reszty nagłówka.
      const LOGO_LINK = '<link rel="preload" href="/exmortis-logo-144.webp" as="image" type="image/webp" />';
      const withHead = out.includes(LOGO_LINK) ? out.replace(LOGO_LINK, `${LOGO_LINK}\n    ${head}`) : out.replace("</head>", `  ${head}\n  </head>`);
      return withHead.replace('<div id="root"></div>', `<div id="root"></div>\n    ${body}`);
    },
  };
}

// Główny arkusz stylów (ok. 22 KB po kompresji) w środku HTML zamiast osobnego pliku: na telefonie oszczędza
// jedno pełne zapytanie przed pierwszym obrazem strony. Tylko przy publikacji (build); plik CSS zostaje w paczce.
function exmInlineCss() {
  return {
    name: "exm-inline-css",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        if (!ctx?.bundle) return html;
        // @font-face wprost w HTML — bez osobnego, blokującego renderowanie żądania /fonts/fonts.css.
        try {
          const fontsCss = fs.readFileSync(path.resolve(process.cwd(), "public/fonts/fonts.css"), "utf8");
          if (fontsCss && !fontsCss.includes("</style")) html = html.replace(/<link rel="stylesheet" href="\/fonts\/fonts\.css"\s*\/?>/, `<style>${fontsCss}</style>`);
        } catch { /* zostaje zwykły link */ }
        // Krytyczny CSS (PageSpeed, FCP): przy powłoce startowej w HTML ląduje tylko ~12 KB reguł potrzebnych do jej
        // narysowania (build/criticalCss.js, wygląd sprawdzony piksel w piksel), zamiast całego arkusza ~120 KB, który
        // przeglądarka musiała przeliczyć przed pierwszym obrazem. Pełny arkusz: preload w nagłówku, dołączany przez
        // skrypt startowy niżej — aplikacja rusza dopiero, gdy jest wczytany (bez mignięcia niestylowanej strony).
        // Bez powłoki (po premierze) — jak dawniej: cały arkusz w HTML.
        const shellSrc = (() => { try { return fs.readFileSync(path.resolve(process.cwd(), "src/content/landingShell.html"), "utf8"); } catch { return ""; } })();
        const hasShell = html.includes('id="exm-shell"') && !!shellSrc;
        let lateCss = null;
        html = html.replace(/<link rel="stylesheet"(?: crossorigin)? href="\/(assets\/[^"]+\.css)">/g, (tag, file) => {
          const asset = ctx.bundle[file];
          const css = asset && asset.type === "asset" ? String(asset.source) : "";
          if (!css || css.length >= 200000 || css.includes("</style")) return tag;
          if (hasShell && !lateCss && /^assets\/index-/.test(file)) {
            let crit = "";
            try { crit = criticalCss(css, shellSrc); } catch (e) { this?.warn?.(`Krytyczny CSS: ${e.message}`); }
            if (crit && crit.length < css.length && !crit.includes("</style")) {
              lateCss = "/" + file;
              return `<style>${crit}</style>`;
            }
          }
          return `<style>${css}</style>`;
        });
        // Start aplikacji PO pierwszym obrazie powłoki: na „/” i „/1-listopada” (do premiery) przeglądarka najpierw maluje
        // gotowy nagłówek i główne zdjęcie, a dopiero potem uruchamia JavaScript (run czeka na dekod zdjęcia powłoki).
        // POBIERANIE (modulepreload + arkusz) rusza od razu w skrypcie startowym — nakłada się z zdjęciem i czcionkami
        // zamiast czekać ~0,7–0,9 s na dekod zdjęcia; LCP aplikacji (powtórne namalowanie tego samego zdjęcia) schodzi
        // o ten czas. Malowanie pierwszego obrazu (FCP) to zostaje bez zmian — pobieranie nie blokuje rysowania.
        // Bezpiecznik: najpóźniej po 1,5 s aplikacja startuje niezależnie od zdjęcia; arkusz CSS — najpóźniej po 4 s.
        const entry = html.match(/<script type="module" crossorigin src="(\/assets\/index-[^"]+\.js)"><\/script>/);
        if (entry && html.includes("</body>")) {
          const [tag, src] = entry;
          // Podpowiedzi modulepreload i pełny CSS są wstrzykiwane dynamicznie (linki tworzone skryptem, nie w nagłówku):
          // w nagłówku startowały przed pierwszym malowaniem i symulacja PageSpeed (4G) doliczała ich pobieranie do FCP.
          const mp = [src];
          html = html.replace(/\s*<link rel="modulepreload" crossorigin href="([^"]+)">/g, (t, h) => { if (!mp.includes(h)) mp.push(h); return ""; });
          const boot = `<script>(function(){var mp=${JSON.stringify(hasShell && lateCss ? mp : [])},pre=function(){if(pre.d)return;pre.d=1;for(var k=0;k<mp.length;k++){var l=document.createElement("link");l.rel="modulepreload";l.crossOrigin="";l.href=mp[k];document.head.appendChild(l)}};var css=${JSON.stringify(lateCss)},cssOn=false,cssOk=!css,wait=[];var done=function(){if(cssOk)return;cssOk=true;for(var k=0;k<wait.length;k++)wait[k]()};var loadCss=function(){if(cssOn||!css)return;cssOn=true;var l=document.createElement("link");l.rel="stylesheet";l.href=css;l.onload=done;l.onerror=done;document.head.appendChild(l);setTimeout(done,4000)};var run=function(){var s=document.createElement("script");s.type="module";s.crossOrigin="";s.src=${JSON.stringify(src)};document.head.appendChild(s)};var go=function(){if(go.d)return;go.d=1;if(cssOk)run();else wait.push(run)};pre();loadCss();try{var o=document.getElementById("exm-shell-root");if(!o){go();return}var im=o.querySelector("img[srcset]");var paint=function(){requestAnimationFrame(function(){setTimeout(go,0)})};var ready=function(){if(im.decode)im.decode().then(paint,paint);else paint()};if(!im||im.complete){im?ready():paint()}else{im.addEventListener("load",ready);im.addEventListener("error",paint)}setTimeout(go,1500)}catch(e){go()}})()</script>`;
          html = html.replace(tag, hasShell && lateCss ? "" : mp.map((h) => `<link rel="modulepreload" crossorigin href="${h}">`).join("\n    ")).replace("</body>", `  ${boot}\n  </body>`);
        }
        return html;
      },
    },
  };
}

// Drobne ikony lucide w jednym pliku zamiast kilkunastu osobnych chunków na ścieżce startowej.
export default defineConfig({
  build: {
    rollupOptions: { output: { manualChunks: (id) => (id.includes("lucide-react") ? "icons" : undefined) } },
  },
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
    exmInlineCss(),
    exmJoinFallback(),
    portableBuild(__dirname),
  ]
});