import { base44 } from "@/api/base44Client";

// Jedno wejście do panelu biblioteki. Uprawnienia sprawdza serwer (rola „admin").
export async function lib(action, payload = {}) {
  try {
    return (await base44.functions.invoke("libraryAdmin", { action, ...payload })).data;
  } catch (e) {
    throw new Error(e?.response?.data?.error || "Nie udało się zapisać.");
  }
}

export const inputCls = "w-full bg-[#0A0A0B] border hairline px-3 py-2 text-sm focus:border-[#C9A24A] outline-none";

export const MODE_LABEL = { off: "Wyłączone", admin: "Tylko admin", on: "Włączone" };
export const MODES = ["off", "admin", "on"];

export const KIND_LABEL = { AUDIO: "Audio", WIDEO: "Wideo", PDF: "PDF", LINK: "Link", TEKST: "Tekst" };
export const KINDS = ["AUDIO", "WIDEO", "PDF", "LINK", "TEKST"];

// Osiem gotowych kolorów znaczników grup.
export const GROUP_COLORS = ["#C9A24A", "#BC1E22", "#8A8A8C", "#3D3D3F", "#4C7A5A", "#3F5F8A", "#7A4C7A", "#8A6A3F"];

// Limity plików pokazywane PRZED wyborem (te same wartości pilnuje serwer).
export const LIMITS = { PDF: { mb: 10, ext: "PDF" }, AUDIO: { mb: 100, ext: "MP3, M4A" } };

export const mb1 = (b) => (Number(b || 0) / 1048576).toFixed(1);
export const gb2 = (b) => (Number(b || 0) / 1073741824).toFixed(2);

const TZ = "Europe/Warsaw";
export const plDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString("pl-PL", { timeZone: TZ, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
export const plDate = (iso) => (iso ? new Date(iso).toLocaleDateString("pl-PL", { timeZone: TZ }) : "—");

// Różnica strefy polskiej wobec UTC w danej chwili (uwzględnia czas letni/zimowy).
function plOffsetMs(utcMs) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hour12: false, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const g = (k) => Number(parts.find((p) => p.type === k).value);
  return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute"), g("second")) - utcMs;
}

// Pole „czasu PL" → UTC ISO. Puste pole = brak terminu.
export function plToUtc(local) {
  if (!local) return null;
  const [d, t] = String(local).split("T");
  if (!d || !t) return null;
  const [y, mo, da] = d.split("-").map(Number);
  const [h, mi] = t.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, da, h, mi);
  return new Date(guess - plOffsetMs(guess)).toISOString();
}

// UTC ISO → wartość pola „czasu PL" (YYYY-MM-DDTHH:mm).
export function utcToPlInput(iso) {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ, hour12: false, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
  return parts.replace(" ", "T").slice(0, 16);
}

// E-maile w widokach panelu pokazujemy w całości tylko tam, gdzie to konieczne.
export const shortDate = (iso) => (iso ? new Date(iso).toLocaleDateString("pl-PL", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" }) : "—");