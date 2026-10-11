// Rezerwacje 1:1 — wspólne: klucze bezpieczeństwa, skróty, tryb modułu.
import { secrets } from "base44:runtime";
import { runSql } from "./supabase.ts";

export const KEYS_MSG = "Rezerwacje chwilowo niedostępne";
const te = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

// Klucz w formacie hex → bajty; inaczej tekst UTF-8. Wartość nigdy nie opuszcza tej funkcji.
function parseKey(name) {
  let s = null;
  try { s = secrets.get(name); } catch { s = null; }
  if (!s || !String(s).trim()) return null;
  s = String(s).trim();
  const isHex = /^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0;
  const bytes = isHex ? Uint8Array.from(s.match(/../g).map((h) => parseInt(h, 16))) : te.encode(s);
  return { bytes, format: isHex ? "hex" : "utf8" };
}

export async function loadKeys(simulateMissing = false) {
  const h = simulateMissing ? null : parseKey("BOOKING_HMAC_KEY");
  const e = simulateMissing ? null : parseKey("BOOKING_ENC_KEY");
  const info = {
    hmac: h ? { present: true, format: h.format, length_ok: h.bytes.length >= 32 } : { present: false },
    enc: e ? { present: true, format: e.format, length_ok: e.bytes.length >= 32 } : { present: false },
  };
  const ok = !!(info.hmac.length_ok && info.enc.length_ok);
  if (!ok) return { ok, info };
  const key = await crypto.subtle.importKey("raw", h.bytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return {
    ok, info,
    hmac: async (text) => hex(await crypto.subtle.sign("HMAC", key, te.encode(String(text)))),
    encPw: btoa(String.fromCharCode(...e.bytes)), // hasło pgcrypto = bajty klucza w base64
  };
}

export const sha256hex = async (text) => hex(await crypto.subtle.digest("SHA-256", te.encode(String(text))));

export function randomToken() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let MODE = { v: null, at: 0 };
export async function getMode(base44, fresh = false) {
  if (!fresh && MODE.v && Date.now() - MODE.at < 15000) return MODE.v;
  const r = await runSql(base44, `SELECT mode FROM public.bk_settings WHERE id = 1`, true).catch(() => []);
  MODE = { v: r?.[0]?.mode || "off", at: Date.now() };
  return MODE.v;
}

// Bez pełnych e-maili i treści w logach.
export const safeErr = (e) => String(e?.message || e).replace(/[^\s@"'()]+@[^\s@"'()]+/g, "[email]").slice(0, 200);

export const CONSENTS = {
  regulamin: { version: "rez-2026-10", text: "Akceptuję regulamin i politykę prywatności exmortis." },
  zdrowie: { version: "rez-2026-10", text: "Zgadzam się na przetwarzanie podanych przeze mnie informacji o zdrowiu wyłącznie w celu przygotowania rozmowy. Dane zostaną usunięte 60 dni po rozmowie." },
};

export const TZ_RE = /^[A-Za-z_+\-\/0-9]{1,64}$/;