import { getSetting } from "./settings.ts";

// Ochrona filmów kursu na własnym serwerze: link z podpisem HMAC-SHA256 i terminem ważności.
// Serwer (skrypt stream.php z panelu) wpuszcza tylko adresy /v/… z poprawnym podpisem przed terminem,
// a pliki trzyma w katalogu niedostępnym z zewnątrz. Format: /v/<plik>?e=<unix>&t=hex(hmac(klucz, "<plik>|<e>")).
export const VIDEO_SETTING = "wideo_ochrona";

async function hmacHex(key: string, msg: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const ttlHours = (s) => Math.max(1, Math.min(24, Math.round(Number(s?.ttl_h) || 4)));

// Zwraca podpisany adres albo null (ochrona wyłączona / adres bez /v/).
export async function signServerVideo(base44, rawUrl: string, settings = null) {
  const s = settings || (await getSetting(base44, VIDEO_SETTING).catch(() => null));
  if (!s?.enabled || !s?.key) return null;
  let u: URL;
  try { u = new URL(rawUrl); } catch { return null; }
  if (!u.pathname.startsWith("/v/")) return null;
  const f = decodeURIComponent(u.pathname.slice(3));
  const ttl = ttlHours(s) * 3600;
  const e = Math.floor(Date.now() / 1000) + ttl;
  u.search = "";
  u.searchParams.set("e", String(e));
  u.searchParams.set("t", await hmacHex(s.key, `${f}|${e}`));
  return { url: u.toString(), expires_in: ttl };
}

export function newVideoKey() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
}
