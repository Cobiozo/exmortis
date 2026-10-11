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