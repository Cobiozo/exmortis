// Wspólna logika modułu biblioteki: ustawienia, przełączniki, tożsamość, widoczność, odbiorcy.

import { runSql, rpc } from "./supabase.ts";

export const MODES = ["off", "admin", "on"];
export const DEFAULT_SETTINGS = { library_mode: "off", messages_mode: "off", email_notify: false, whatsapp: null, space_limit_mb: 5120 };

let CFG = null;
let CFG_AT = 0;

// Ustawienia modułu — 30 s pamięci w instancji (jak przy SMTP).
export async function libSettings(base44, fresh = false) {
  if (!fresh && CFG && Date.now() - CFG_AT < 30000) return CFG;
  const rows = await runSql(base44,
    `SELECT library_mode, messages_mode, email_notify, whatsapp, space_limit_mb FROM public.mb_settings WHERE id = 1`, true);
  CFG = rows && rows[0] ? rows[0] : { ...DEFAULT_SETTINGS };
  CFG_AT = Date.now();
  return CFG;
}
export const resetLibSettings = () => { CFG_AT = 0; };

// „off" = nikt (404), „admin" = tylko administrator, „on" = każdy zalogowany.
export function modeVisible(mode, me) {
  if (mode === "on") return true;
  if (mode === "admin") return me && me.role === "admin";
  return false;
}

export const clientEmail = (me) => String((me && me.email) || "").trim().toLowerCase();

// Imię do zmiennej {imię}: pole konta, potem pierwszy wyraz nazwy.
export function firstName(me) {
  const a = String((me && me.imie) || "").trim();
  if (a) return a;
  const b = String((me && me.full_name) || "").trim();
  return b ? b.split(/\s+/)[0] : "";
}

// Reguła widoczności i lista odbiorców żyją w bazie — jedno miejsce prawdy dla obu funkcji.
export const visibleMaterials = (base44, email, admin) =>
  rpc(base44, "mb_visible_materials", { p_email: String(email || ""), p_admin: !!admin });

export const resolveRecipients = (base44, target) =>
  rpc(base44, "mb_resolve_recipients", { p_target: target || {} });

export const moveLibraryEmail = (base44, oldEmail, newEmail) =>
  rpc(base44, "mb_move_email", { p_old: String(oldEmail || ""), p_new: String(newEmail || "") });

// Porównanie w czasie stałym (token zadania).
export function safeEqual(a, b) {
  const x = String(a == null ? "" : a);
  const y = String(b == null ? "" : b);
  if (!x.length || x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}

export function randomToken() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Adresy do stopki wiadomości (bez treści w logach).
export const footerData = (me, s) => ({
  mailto: `mailto:${String((me && me.email) || "")}`,
  whatsapp: s && s.whatsapp ? s.whatsapp : null,
  crisis: "Jeśli jesteś w kryzysie: 116 123 · 800 70 2222 (całą dobę, bezpłatnie) · 112.",
  reply: "Na tę wiadomość odpowiesz e-mailem lub na WhatsAppie.",
});