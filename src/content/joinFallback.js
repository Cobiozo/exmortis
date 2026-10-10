import { FALLBACK_EVENTS } from "./joinFallbackData";

const ms = (s) => new Date(String(s).replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00")).getTime();
const same = (a, b) => ms(a) === ms(b);
const find = (key) => FALLBACK_EVENTS.find((e) => e.slug === key || (e.short_path && e.short_path === key));

// Stan pokoju z wbudowanej kopii — tylko gdy serwer nie odpowiada. Dane z serwera mają pierwszeństwo.
export function joinFallback(key) {
  const ev = find(key);
  if (!ev) return null;
  const st = new Date(ev.start_datetime).getTime(), n = Date.now();
  const state = n < st - ev.open_minutes * 60000 ? "przed" : n <= st + (ev.duration_minutes + 30) * 60000 ? "otwarte" : "po";
  return { ...ev, state };
}

// Panel: czy wbudowana kopia zgadza się z danymi spotkania. null = nie dotyczy (nie online / minione / nieopublikowane).
export function fallbackFresh(e) {
  if (e.format !== "Online" || !["Opublikowane", "Odwołane"].includes(e.status) || !e.start_datetime) return null;
  if (new Date(e.start_datetime).getTime() + (Number(e.duration_minutes) || 60) * 60000 < Date.now()) return null;
  const f = find(e.slug);
  return !!f && f.title === e.title && same(f.start_datetime, e.start_datetime)
    && f.duration_minutes === (Number(e.duration_minutes) || 60) && f.open_minutes === (Number(e.open_minutes) || 15)
    && (f.short_path || null) === (e.short_path || null);
}