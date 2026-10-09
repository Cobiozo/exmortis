import { runSql, escStr } from "./supabase.ts";
import { clearSnap } from "./snapshot.ts";

// Ustawienia integracji (payu / smtp) przechowywane jako jsonb w app_settings.

// Tabela istnieje od wdrożenia — sprawdzamy najwyżej raz na instancję, nie przy każdym odczycie.
let TABLE_OK = false;
export async function ensureSettingsTable(base44) {
  if (TABLE_OK) return;
  TABLE_OK = true;
  await runSql(
    base44,
    `CREATE TABLE IF NOT EXISTS public.app_settings (
      key text PRIMARY KEY,
      value jsonb NOT NULL,
      updated_date timestamptz DEFAULT now()
    )`
  );
}

// Dane firmy do stopek e-maili — wczytywane razem z ustawieniami SMTP.
export let FIRMA = null;

export async function getSetting(base44, key) {
  await ensureSettingsTable(base44);
  const rows = await runSql(
    base44,
    `SELECT value FROM public.app_settings WHERE key = ${escStr(key)}`,
    true
  );
  const value = rows && rows.length > 0 ? rows[0].value : null;
  if (key === "smtp") FIRMA = await getSetting(base44, "firma").catch(() => null);
  return value;
}

// Adres aplikacji (APP_URL) — ustawiany w panelu admina, używany we wszystkich linkach w e-mailach i przekierowaniach.
export const DEFAULT_APP_URL = "https://preview--exmortis-return-path.base44.app";
export let APP_URL = DEFAULT_APP_URL;

export function cleanAppUrl(v) {
  const s = String(v || "").trim().replace(/\/+$/, "");
  if (!/^https:\/\/[^\s/]+\.[^\s/]+$/.test(s)) throw new Error("Podaj adres w formie https://twojadomena.pl (bez ścieżki)");
  return s;
}

let APP_URL_AT = 0;
export async function loadAppUrl(base44) {
  if (Date.now() - APP_URL_AT < 300000) return APP_URL;
  const s = await getSetting(base44, "app").catch(() => null);
  APP_URL = s?.url || DEFAULT_APP_URL;
  APP_URL_AT = Date.now();
  return APP_URL;
}

// Kilka kluczy jednym zapytaniem tylko do odczytu (bez CREATE TABLE), z pamięcią 60 s w instancji.
const CACHE = new Map<string, { v: unknown; at: number }>();
export async function getSettingsFast(base44, keys: string[]) {
  const ck = keys.join(",");
  const hit = CACHE.get(ck);
  if (hit && Date.now() - hit.at < 60000) return hit.v as Record<string, any>;
  const rows = await runSql(
    base44,
    `SELECT key, value FROM public.app_settings WHERE key IN (${keys.map(escStr).join(",")})`,
    true
  ).catch(() => []);
  const out: Record<string, any> = {};
  for (const r of rows || []) out[r.key] = r.value;
  CACHE.set(ck, { v: out, at: Date.now() });
  return out;
}

export async function saveSetting(base44, key, value) {
  CACHE.clear();
  APP_URL_AT = 0;
  await clearSnap(base44, "settings");
  await ensureSettingsTable(base44);
  const json = JSON.stringify(value);
  await runSql(
    base44,
    `INSERT INTO public.app_settings (key, value)
     VALUES (${escStr(key)}, ${escStr(json)}::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = ${escStr(json)}::jsonb, updated_date = now()`
  );
}

export async function deleteSetting(base44, key) {
  await ensureSettingsTable(base44);
  await runSql(base44, `DELETE FROM public.app_settings WHERE key = ${escStr(key)}`);
}