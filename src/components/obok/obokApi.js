import { base44 } from "@/api/base44Client";
import { SIM_KEY } from "@/lib/usePrelaunch";

// Wywołania strefy Obok (podgląd dnia admina przekazywany jako sim).
export const obok = (action, data = {}) =>
  base44.functions.invoke("obok", { action, sim: sessionStorage.getItem(SIM_KEY) || undefined, ...data }).then((r) => r.data);

export const OBOK_SUB = "Obok — nagrania na drogę powrotu. Kilka minut mojego głosu i jedno pytanie na wieczór. Dla osób z kontem, za darmo.";
export const when = (iso) => new Date(iso).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
export const mins = (s) => (s ? `${Math.max(1, Math.round(s / 60))} min` : "");