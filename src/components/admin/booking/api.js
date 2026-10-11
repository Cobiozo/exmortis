import { base44 } from "@/api/base44Client";

export async function bk(action, payload = {}) {
  try {
    return (await base44.functions.invoke("bookingAdmin", { action, ...payload })).data;
  } catch (e) {
    throw new Error(e?.response?.data?.error || "Nie udało się zapisać.");
  }
}

export const inputCls = "w-full bg-[#0A0A0B] border hairline px-3 py-2 text-sm focus:border-[#C9A24A] outline-none";
export const DAYS = ["", "Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Ndz"];
export const plDateTime = (iso) => new Date(iso).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });