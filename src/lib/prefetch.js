import { base44 } from "@/api/base44Client";
import { mediaSrcSet } from "@/lib/imgSrcSet";
import { LISTOPAD_COVER, LISTOPAD_EVENT } from "@/components/cms/defaults/listopadDefault";

// Startuje przy wczytaniu skryptu, równolegle: ustawienia, treści i bieżąca strona z edytora.
const PRE_END = new Date("2026-11-01T20:30:00.000Z").getTime();
const path = window.location.pathname;
const SLUG = { "/1-listopada": "1-listopada", ...(Date.now() < PRE_END ? { "/": "zapowiedz" } : {}) }[path];

const settingsP = base44.functions.invoke("siteSettings", {}).then((r) => r.data);
const contentP = base44.functions.invoke("siteContent", {}).then((r) => r.data);
const pageP = SLUG ? base44.entities.PublishedPage.filter({ slug: SLUG }, { limit: 1 }) : null;
const eventP = path === "/1-listopada" ? base44.functions.invoke("eventsPublic", { action: "get", slug: LISTOPAD_EVENT }).then((r) => r.data.event) : null;
[settingsP, contentP, pageP, eventP].forEach((p) => p?.catch(() => {}));
let usedE = false;
export const takeEvent = (slug) => (slug === LISTOPAD_EVENT && eventP && !usedE ? ((usedE = true), eventP) : null);

let usedS = false, usedC = false, usedP = false;
export const takeSettings = () => (usedS ? null : ((usedS = true), settingsP));
export const takeContent = () => (usedC ? null : ((usedC = true), contentP));
export const takePage = (slug) => (slug === SLUG && !usedP ? ((usedP = true), pageP) : null);

// Najważniejszy obraz /1-listopada (świeca): preload w WebP, rozmiar wg ekranu.
if (path === "/1-listopada") {
  const s = mediaSrcSet(LISTOPAD_COVER);
  if (s) {
    const l = document.createElement("link");
    Object.assign(l, { rel: "preload", as: "image", href: s.src });
    l.setAttribute("imagesrcset", s.srcSet);
    l.setAttribute("imagesizes", "100vw");
    l.setAttribute("fetchpriority", "high");
    document.head.appendChild(l);
  }
}