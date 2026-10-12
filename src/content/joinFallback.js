import { FALLBACK_AT, FALLBACK_EVENTS } from "virtual:exm-join-fallback";

// Dane awaryjne strony /dolacz (gdy serwer nie odpowiada) — dwa źródła, nowsze wygrywa:
// 1) kopia wbudowana przy każdej publikacji strony (pobierana automatycznie z bazy podczas budowania),
// 2) kopia w przeglądarce uczestnika, zapisywana przy każdym udanym wczytaniu spotkania (strona spotkania, /dolacz, 1 listopada).
const KEY = "exm_join_fb";
const ms = (s) => new Date(String(s).replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00")).getTime();
const same = (a, b) => ms(a) === ms(b);
const pick = (e) => ({ slug: e.slug, short_path: e.short_path || null, title: e.title, start_datetime: e.start_datetime,
  duration_minutes: Number(e.duration_minutes) || 60, open_minutes: Number(e.open_minutes) || 15 });

function cached() {
  try { const c = JSON.parse(localStorage.getItem(KEY)); return c && Array.isArray(c.events) ? c : null; } catch { return null; }
}
// Zapamiętaj spotkanie online w tej przeglądarce (bez linków — tylko to, co i tak jest publiczne).
export function rememberJoinEvent(e) {
  if (!e || !e.slug || !e.start_datetime || (e.format && e.format !== "Online")) return;
  try {
    const c = cached() || { events: [] };
    const events = [pick(e), ...c.events.filter((x) => x.slug !== e.slug && ms(x.start_datetime) > Date.now() - 864e5)].slice(0, 20);
    localStorage.setItem(KEY, JSON.stringify({ at: new Date().toISOString(), events }));
  } catch { /* pamięć przeglądarki niedostępna — zostaje kopia wbudowana */ }
}
const find = (key) => {
  const hit = (list) => (list || []).find((e) => e.slug === key || (e.short_path && e.short_path === key));
  const c = cached();
  const local = c && ms(c.at) > ms(FALLBACK_AT) ? hit(c.events) : null;
  return local || hit(FALLBACK_EVENTS) || (c ? hit(c.events) : null);
};

// Stan pokoju z kopii — tylko gdy serwer nie odpowiada. Dane z serwera mają pierwszeństwo.
export function joinFallback(key) {
  const ev = find(key);
  if (!ev) return null;
  const st = new Date(ev.start_datetime).getTime(), n = Date.now();
  const state = n < st - ev.open_minutes * 60000 ? "przed" : n <= st + (ev.duration_minutes + 30) * 60000 ? "otwarte" : "po";
  return { ...ev, state };
}

// Panel: czy kopia wbudowana zgadza się z danymi spotkania. null = nie dotyczy (nie online / minione / nieopublikowane).
export function fallbackFresh(e) {
  if (e.format !== "Online" || !["Opublikowane", "Odwołane"].includes(e.status) || !e.start_datetime) return null;
  if (new Date(e.start_datetime).getTime() + (Number(e.duration_minutes) || 60) * 60000 < Date.now()) return null;
  const f = (FALLBACK_EVENTS || []).find((x) => x.slug === e.slug);
  return !!f && f.title === e.title && same(f.start_datetime, e.start_datetime)
    && f.duration_minutes === (Number(e.duration_minutes) || 60) && f.open_minutes === (Number(e.open_minutes) || 15)
    && (f.short_path || null) === (e.short_path || null);
}
export { FALLBACK_AT };
