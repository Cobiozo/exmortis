// Podpis HMAC dla obrazów prywatnych modułów serwowanych przez proxy /functions/media (audyt W6).
// Funkcje serwera dopisują do adresu podpis z terminem ważności (domyślnie 15 minut), a proxy
// weryfikuje podpis — obraz z podpisanego adresu jest osiągalny tylko do końca okna, nawet gdy
// adres wycieknie (np. z adresu obrazka w materiale). Klucz pochodny od sekretu aplikacji
// (BOOKING_HMAC_KEY) z odrębną domeną — nigdy nie jest identyczny z kluczem rezerwacji.
import { secrets } from "base44:runtime";

const te = new TextEncoder();
export const MEDIA_TTL = 900; // 15 minut

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

// Bez sekretu podpisu nie ma: adresy wracają bez zmian, a proxy dopuszcza je po pochodzeniu
// (zachowanie sprzed audytu) — podpis jest dodatkową warstwą, nie warunkiem działania strony.
async function hmacKey() {
  let s = null;
  try { s = secrets.get("BOOKING_HMAC_KEY"); } catch { s = null; }
  if (!s || !String(s).trim()) return null;
  const bytes = await crypto.subtle.digest("SHA-256", te.encode(`exmortis/media-v1:${String(s).trim()}`));
  return crypto.subtle.importKey("raw", bytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

export async function mediaSignature(pub_id, expires) {
  const key = await hmacKey();
  if (!key) return null;
  return hex(await crypto.subtle.sign("HMAC", key, te.encode(`${pub_id}|${expires}`)));
}

// Stałoczasowe porównanie skrótów.
export async function verifyMediaSignature(pub_id, expires, sig) {
  if (!/^\d+$/.test(String(expires || "")) || !/^[0-9a-f]{64}$/.test(String(sig || ""))) return false;
  const expected = await mediaSignature(pub_id, Number(expires));
  if (!expected) return false;
  const a = String(sig), b = expected;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < b.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Adres proxy z dopisanym podpisem i terminem; inne adresy bez zmian.
export async function signMediaUrl(raw) {
  const m = /^\/functions\/media\?id=([a-f0-9]{32})(?:&|$)/.exec(String(raw || ""));
  if (!m) return raw;
  const expires = Math.floor(Date.now() / 1000) + MEDIA_TTL;
  const sig = await mediaSignature(m[1], expires);
  if (!sig) return raw;
  return `${raw}&e=${expires}&s=${sig}`;
}

// Podpisuje każdy bezpośredni adres proxy w strukturze (obiekty, tablice, zagnieżdżenia). Zwraca kopię.
export async function signAllMedia(value) {
  if (typeof value === "string") {
    if (!value.startsWith("/functions/media?id=")) return value;
    return await signMediaUrl(value);
  }
  if (Array.isArray(value)) return Promise.all(value.map(signAllMedia));
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value)) out[k] = await signAllMedia(value[k]);
    return out;
  }
  return value;
}