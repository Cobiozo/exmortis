import { runSql, escStr } from "./supabase.ts";

// Ustawienia integracji (payu / smtp) przechowywane jako jsonb w app_settings.

export async function ensureSettingsTable(base44) {
  await runSql(
    base44,
    `CREATE TABLE IF NOT EXISTS public.app_settings (
      key text PRIMARY KEY,
      value jsonb NOT NULL,
      updated_date timestamptz DEFAULT now()
    )`
  );
}

export async function getSetting(base44, key) {
  await ensureSettingsTable(base44);
  const rows = await runSql(
    base44,
    `SELECT value FROM public.app_settings WHERE key = ${escStr(key)}`,
    true
  );
  return rows && rows.length > 0 ? rows[0].value : null;
}

// Adres aplikacji (APP_URL) — ustawiany w panelu admina, używany we wszystkich linkach w e-mailach i przekierowaniach.
export const DEFAULT_APP_URL = "https://preview--exmortis-return-path.base44.app";
export let APP_URL = DEFAULT_APP_URL;

export function cleanAppUrl(v) {
  const s = String(v || "").trim().replace(/\/+$/, "");
  if (!/^https:\/\/[^\s/]+\.[^\s/]+$/.test(s)) throw new Error("Podaj adres w formie https://twojadomena.pl (bez ścieżki)");
  return s;
}

export async function loadAppUrl(base44) {
  const s = await getSetting(base44, "app").catch(() => null);
  APP_URL = s?.url || DEFAULT_APP_URL;
  return APP_URL;
}

export async function saveSetting(base44, key, value) {
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