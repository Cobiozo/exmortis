import { base44 } from "@/api/base44Client";
import { mediaSrcSet } from "@/lib/imgSrcSet";
import "@/lib/outbox"; // dosyła zaległe formularze z poprzednich wizyt
import { readCache, readCacheAge, writeCache } from "@/lib/swrCache";
import { LISTOPAD_COVER, LISTOPAD_EVENT } from "@/components/cms/defaults/listopadDefault";

// Jedno wywołanie startowe („bootstrap”): ustawienia + treści + strona z edytora + spotkanie.
// Kopia młodsza niż 5 min → bez wywołania. Błąd lub brak odpowiedzi w 2 s → kopia albo treść wbudowana,
// ponowienie w tle po 5, 15 i 60 s. Gość nie widzi komunikatu o błędzie.
const PRE_END = new Date("2026-11-01T20:30:00.000Z").getTime();
const FRESH = 5 * 60000;
const path = window.location.pathname;
const SLUG = { "/1-listopada": "1-listopada", "/kontakt": "kontakt", ...(Date.now() < PRE_END ? { "/": "zapowiedz" } : {}) }[path];
const EVENT = path === "/1-listopada" ? LISTOPAD_EVENT : null;
const KEY = "boot_" + path;

// Wbudowane zabezpieczenie: tryb przedpremierowy włączony do 1.11, 21:30.
export const DEFAULT_SETTINGS = { firma: {}, premiera: { do: new Date(PRE_END).toISOString(), wylaczony: false }, ja_dostep: false };

const call = () => Promise.race([
  base44.functions.invoke("bootstrap", { page: SLUG, event: EVENT }).then((r) => r.data),
  new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 2000)),
]);
const save = (b) => { if (b.settings && b.content) writeCache(KEY, b); return b; };

function retry(delays) {
  if (!delays.length) return;
  setTimeout(() => call().then((b) => { save(b); window.dispatchEvent(new CustomEvent("exm-boot", { detail: b })); })
    .catch(() => retry(delays.slice(1))), delays[0] * 1000);
}

const cached = readCacheAge(KEY);
const bootP = cached && cached.age < FRESH
  ? Promise.resolve({ ...cached.data, _cache: true })
  : call().then(save).catch(() => { retry([5, 15, 60]); return { ...(cached?.data || {}), _cache: true }; });

export const onBoot = (cb) => { const h = (e) => cb(e.detail); window.addEventListener("exm-boot", h); return () => window.removeEventListener("exm-boot", h); };

let usedS = false, usedC = false, usedP = false, usedE = false;
export const takeSettings = () => (usedS ? null : ((usedS = true), bootP.then((b) =>
  b.settings ? { ...b.settings, _cache: !!b._cache } : { ...(readCache("settings") || DEFAULT_SETTINGS), _cache: true, _fallback: !readCache("settings") })));
export const takeContent = () => (usedC ? null : ((usedC = true), bootP.then((b) => ({ content: b.content || null }))));
export const takePage = (slug) => (slug === SLUG && !usedP ? ((usedP = true), bootP.then((b) =>
  b.page !== undefined ? { items: b.page ? [b.page] : [] } : { items: [readCache("page_" + slug) || null].filter(Boolean) })) : null);
export const takeEvent = (slug) => (slug === EVENT && !usedE ? ((usedE = true), bootP.then((b) =>
  b.event !== undefined ? b.event : readCache("events")?.[slug] || Promise.reject(new Error("brak")))) : null);

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