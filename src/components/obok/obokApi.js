import { base44 } from "@/api/base44Client";
import { SIM_KEY } from "@/lib/usePrelaunch";
import { viewerTz, warsawNote, timeText } from "@/components/exmortis/events/time";

// Wywołania strefy Obok (podgląd dnia admina przekazywany jako sim).
export const obok = (action, data = {}) =>
  base44.functions.invoke("obok", { action, sim: sessionStorage.getItem(SIM_KEY) || undefined, ...data }).then((r) => r.data);

export const OBOK_SUB = "Obok — nagrania na drogę powrotu. Kilka minut mojego głosu i jedno pytanie na wieczór. Dla osób z kontem, za darmo.";
export const when = (iso) => {
  const v = new Date(iso).toLocaleString("pl-PL", { timeZone: viewerTz(), weekday: "short", day: "numeric", month: "numeric" });
  const n = warsawNote(iso);
  return `${v}, ${timeText(iso)}${n ? ` · ${n}` : ""}`;
};
export const mins = (s) => (s ? `${Math.max(1, Math.round(s / 60))} min` : "");