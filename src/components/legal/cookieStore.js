import { COOKIES_VERSION } from "@/content/legal/seller";

const KEY = "exm_cookie_consent";
const YEAR = 365 * 86400000;

// Zwraca zapisany wybór albo null (brak, wygasł po 12 mies. lub zmieniła się wersja polityki).
export function readConsent() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY));
    if (!c || c.v !== COOKIES_VERSION || Date.now() - c.at > YEAR) return null;
    return c;
  } catch { return null; }
}

export function saveConsent(analytics, marketing) {
  if (!analytics) localStorage.removeItem("base44_analytics_session_id");
  localStorage.setItem(KEY, JSON.stringify({ v: COOKIES_VERSION, at: Date.now(), analytics, marketing }));
  if (!marketing) {
    // Usuń ciasteczka marketingowe Meta, które da się usunąć.
    ["_fbp", "_fbc"].forEach((n) => { document.cookie = `${n}=; Max-Age=0; path=/`; document.cookie = `${n}=; Max-Age=0; path=/; domain=.${location.hostname}`; });
  }
  window.dispatchEvent(new Event("exm:consent"));
}

export const openCookieSettings = () => window.dispatchEvent(new Event("exm:cookies"));