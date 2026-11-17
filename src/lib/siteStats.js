// Własny licznik odwiedzin (decyzja właściciela 17.11.2026 — zamiast GA4).
// Do bazy (funkcja site_hit) trafiają WYŁĄCZNIE sumy dzienne: ścieżka strony, rodzaj źródła wejścia
// (np. „google”, „instagram”) i nazwa zdarzenia (np. „AddToCart”). Bez ciasteczek, bez zapisu w przeglądarce,
// bez IP, konta, e-maila i parametrów adresu — dlatego nie wymaga zgody z banera.
// Wpis do Polityki prywatności: jedno zdanie o anonimowej statystyce (do dopisania przy kolejnej wersji).
import { SUPABASE_URL, ANON_KEY, hasSupabase } from "@/api/exmSupabase";
import { supaBearer } from "@/api/exmAuth";

function hit(kind, name) {
  if (!hasSupabase || typeof window === "undefined") return;
  if (navigator.webdriver) return; // automaty testowe i roboty z przeglądarką — nie liczymy
  fetch(`${SUPABASE_URL}/rest/v1/rpc/site_hit`, {
    method: "POST",
    keepalive: true,
    credentials: "omit",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_kind: kind, p_name: name }),
  }).catch(() => {});
}

// Strony z prywatnym kluczem w adresie i panel — nie liczymy (adres zawiera token albo dane konta).
const PRIVATE = /^\/(admin|skaner|listy\/|zmiana-adresu|rezerwacja\/|karta|bilet|konto|login|register|forgot-password|reset-password|powrot\/(ankieta|platnosc))/;

// Ścieżka bez parametrów, małymi literami, bez końcowego ukośnika; /spotkania/x/dolacz → bez liczenia.
export function countPage(pathname) {
  const p = (String(pathname || "/").toLowerCase().replace(/\/+$/, "") || "/").slice(0, 80);
  if (PRIVATE.test(p) || /\/dolacz$/.test(p)) return;
  if (!/^\/[a-z0-9/_-]*$/.test(p)) return;
  hit("strona", p);
}

// Źródło wejścia — raz na wczytanie strony (pamięć tylko w zmiennej, nic nie zostaje w przeglądarce).
let sourceDone = false;
const HOSTS = [
  [/google\./, "google"], [/bing\.|duckduckgo\.|yahoo\./, "bing"], [/facebook\.|fb\.|messenger\./, "facebook"],
  [/instagram\./, "instagram"], [/youtube\.|youtu\.be/, "youtube"], [/whatsapp\.|wa\.me/, "whatsapp"],
  [/tiktok\./, "tiktok"], [/spotify\./, "spotify"], [/linkedin\./, "linkedin"],
  [/mail\.|poczta|outlook\.|gmail\./, "listy"],
];
export function countSource() {
  if (sourceDone || typeof window === "undefined") return;
  sourceDone = true;
  if (PRIVATE.test(window.location.pathname)) return;
  const q = new URLSearchParams(window.location.search);
  const utm = String(q.get("utm_source") || q.get("src") || "").toLowerCase();
  let name = "";
  if (utm) {
    const hit1 = HOSTS.find(([re]) => re.test(utm + "."));
    name = hit1 ? hit1[1] : /^(ig|insta)/.test(utm) ? "instagram" : /^(fb|face)/.test(utm) ? "facebook"
      : /^(nl|newsletter|listy|email|mail)/.test(utm) ? "listy" : /^(wa|whats)/.test(utm) ? "whatsapp" : "kampania";
    // Linki wewnętrzne z ?src= (np. /test?src=home-hero) to nie źródło wejścia z zewnątrz.
    if (!q.get("utm_source") && /^(home|powrot|skarbiec|test|o-mnie|cisza|glos)/.test(utm)) name = "";
  }
  if (!name) {
    let host = "";
    try { host = document.referrer ? new URL(document.referrer).hostname.toLowerCase() : ""; } catch { host = ""; }
    if (!host) name = "bezposrednio";
    else if (host === window.location.hostname || host.endsWith("exmortis.pl")) return; // przejście wewnętrzne
    else name = (HOSTS.find(([re]) => re.test(host)) || [null, "inne"])[1];
  }
  hit("zrodlo", name);
}

// Zdarzenie (np. „AddToCart”, „Lead_newsletter”) — tylko nazwa, bez parametrów.
export function countEvent(name, params) {
  const extra = params && typeof params.content_name === "string" ? `_${params.content_name}` : "";
  const n = `${name}${extra}`.replace(/[^A-Za-z0-9_]/g, "_").slice(0, 40);
  if (n.length >= 2) hit("zdarzenie", n);
}

// Panel: sumy dzienne [{ day, kind, name, n }] z ostatnich `days` dni (tylko zespół).
export async function siteStats(days = 90) {
  const token = await supaBearer().catch(() => null);
  if (!token) throw new Error("Brak sesji");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/site_stats_get`, {
    method: "POST",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_days: days }),
  });
  if (!res.ok) throw new Error(`Statystyki: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}
