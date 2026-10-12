import { base44 } from "@/api/base44Client";

// Powiadomienia klienta (dzwoneczek). Jedna funkcja serwera „notifications”.
export const notif = (action, data = {}) => base44.functions.invoke("notifications", { action, ...data }).then((r) => r.data);
// Zdarzenie: odśwież dzwoneczek (np. po zmianie ustawień albo przeczytaniu ogłoszenia na koncie).
export const NOTIF_REFRESH = "exm:notif-refresh";
export const refreshNotif = () => window.dispatchEvent(new Event(NOTIF_REFRESH));

export function ago(iso) {
  const t = new Date(iso).getTime();
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 90) return "przed chwilą";
  if (s < 3600) return `${Math.round(s / 60)} min temu`;
  if (s < 86400) return `${Math.round(s / 3600)} godz. temu`;
  const d = Math.floor(s / 86400);
  if (d === 1) return "wczoraj";
  if (d < 7) return `${d} dni temu`;
  return new Date(t).toLocaleDateString("pl-PL", { day: "numeric", month: "short", timeZone: "Europe/Warsaw" });
}
