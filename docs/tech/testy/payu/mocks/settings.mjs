export let FIRMA = null;
export const APP_URL = "https://exmortis.pl";
export const DEFAULT_APP_URL = "https://exmortis.pl";
export async function getSetting(_b, key) { return (globalThis.__settings || {})[key] ?? null; }
export async function getSettingsFast(_b, keys) { return Object.fromEntries(keys.map((k) => [k, (globalThis.__settings || {})[k] ?? null])); }
export async function loadAppUrl() { return APP_URL; }
export async function saveSetting() {}
