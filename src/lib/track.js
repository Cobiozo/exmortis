import { readConsent } from "@/components/legal/cookieStore";

// Warstwa pomiaru (Meta Pixel + GA4). Skrypty ładują się i zdarzenia wychodzą WYŁĄCZNIE za zgodą
// z banera cookies: analityczne → GA4 (consent mode, analytics_storage), marketingowe → Meta Pixel.
// Bez zgody nie ma ani jednego zapytania do googletagmanager.com ani facebook.net.
// Do pikseli nigdy nie trafiają e-mail, imię ani treść formularza — tylko nazwa zdarzenia i kwota.
let cfg = { wlaczony: false, pixel_id: "", ga4_id: "" };
let gaOn = false;
let fbOn = false;
let lastPage = "";

export function setTrackSettings(p) {
  cfg = {
    wlaczony: !!(p && p.wlaczony),
    pixel_id: String(p?.pixel_id || "").trim(),
    ga4_id: String(p?.ga4_id || "").trim(),
  };
}

// Zgoda czytana przy każdym wywołaniu — cofnięcie w banerze natychmiast zatrzymuje wysyłkę.
const consent = () => readConsent() || {};
export const gaAllowed = () => cfg.wlaczony && !!cfg.ga4_id && consent().analytics === true;
export const fbAllowed = () => cfg.wlaczony && !!cfg.pixel_id && consent().marketing === true;

function loadGa() {
  if (gaOn || !gaAllowed()) return;
  gaOn = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  // Tryb zgody: domyślnie odmowa, zgoda dopiero gdy baner ją dał (i tylko na analitykę).
  window.gtag("consent", "default", {
    ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied",
  });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(cfg.ga4_id)}`;
  document.head.appendChild(s);
  window.gtag("consent", "update", { analytics_storage: "granted" });
  window.gtag("js", new Date());
  window.gtag("config", cfg.ga4_id, { anonymize_ip: true, send_page_view: false });
}

function loadFb() {
  if (fbOn || !fbAllowed()) return;
  fbOn = true;
  if (!window.fbq) {
    const n = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    n.queue = []; n.loaded = true; n.version = "2.0";
    window.fbq = n;
    window._fbq = n;
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(s);
  }
  window.fbq("init", cfg.pixel_id);
}

// Wołane przy starcie i po każdej zmianie zgody — doładowuje to, na co zgoda właśnie jest.
export function applyConsent() {
  if (gaAllowed()) loadGa();
  if (fbAllowed()) loadFb();
}

// Zdarzenie trafia tylko do tego narzędzia, na które jest zgoda.
export function track(name, params) {
  const p = params || {};
  if (gaAllowed()) { loadGa(); window.gtag("event", name, p); }
  if (fbAllowed()) { loadFb(); window.fbq("track", name, p); }
}

// PageView przy zmianie adresu — raz na dany adres (także wtedy, gdy zgoda przyszła w trakcie wizyty).
export function trackPageView(key) {
  const k = key || window.location.pathname + window.location.search;
  if (k === lastPage || (!gaAllowed() && !fbAllowed())) return;
  lastPage = k;
  if (gaAllowed()) { loadGa(); window.gtag("event", "page_view", { page_path: k, page_location: window.location.href, page_title: document.title }); }
  if (fbAllowed()) { loadFb(); window.fbq("track", "PageView"); }
}

// Purchase: raz na zamówienie. Wysyłamy wyłącznie kwotę i walutę — bez danych osobowych.
export function trackPurchase(orderId, value) {
  if (!orderId || (!gaAllowed() && !fbAllowed())) return;
  const K = "exm_track_purchase";
  try { if (localStorage.getItem(K) === String(orderId)) return; } catch { /* bez pamięci przeglądarki */ }
  track("Purchase", { value: Math.round((Number(value) || 0) * 100) / 100, currency: "PLN" });
  try { localStorage.setItem(K, String(orderId)); } catch { /* bez pamięci przeglądarki */ }
}