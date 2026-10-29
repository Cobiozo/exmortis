import { getSetting, saveSetting } from "./settings.ts";

// Token Instagrama po migracji: sekret INSTAGRAM_ACCESS_TOKEN (Deno.env), a gdy w app_settings
// leży świeższy token po odświeżeniu — ten z bazy. Wartość tokenu nigdy nie trafia do logów.
export const TOKEN_KEY = "instagram_token";
export const EXPIRES_KEY = "instagram_token_expires_at";
const REFRESH_DAYS = 20; // odświeżamy, gdy zostało mniej niż 20 dni ważności

const envToken = () => String((globalThis as any).Deno?.env?.get?.("INSTAGRAM_ACCESS_TOKEN") || "").trim();

export async function currentInstagramToken(base44) {
  const saved = await getSetting(base44, TOKEN_KEY).catch(() => null);
  const fromDb = typeof saved === "string" ? saved.trim() : "";
  return fromDb || envToken();
}

// Odświeżenie długoterminowego tokenu Instagrama (ważny 60 dni, refresh_access_token przedłuża go o kolejne 60).
// Bez znanej daty wygaśnięcia próbujemy raz — cronTick pilnuje, żeby działo się to najwyżej raz na dobę.
// Zwracamy tylko liczby i daty: token nie może trafić do logów, raportu ani odpowiedzi.
export async function refreshInstagramToken(base44) {
  const token = await currentInstagramToken(base44);
  if (!token) return { ok: false, refreshed: false, error: "brak tokenu" };

  const exp = await getSetting(base44, EXPIRES_KEY).catch(() => null);
  const expMs = exp ? Date.parse(String(exp)) : NaN;
  const daysLeft = Number.isFinite(expMs) ? Math.floor((expMs - Date.now()) / 86400000) : null;
  if (daysLeft !== null && daysLeft >= REFRESH_DAYS) return { ok: true, refreshed: false, days_left: daysLeft };

  const res = await fetch(
    `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`,
    { signal: AbortSignal.timeout(20000) }
  );
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) {
    const err = String(j?.error?.message || res.status).slice(0, 120);
    console.error("instagram: odświeżenie tokenu nie powiodło się —", err);
    return { ok: false, refreshed: false, days_left: daysLeft, error: err };
  }

  const expiresAt = new Date(Date.now() + Number(j.expires_in || 5184000) * 1000).toISOString();
  await saveSetting(base44, TOKEN_KEY, String(j.access_token));
  await saveSetting(base44, EXPIRES_KEY, expiresAt);
  return {
    ok: true,
    refreshed: true,
    expires_at: expiresAt,
    days_left: Math.floor((Date.parse(expiresAt) - Date.now()) / 86400000),
  };
}