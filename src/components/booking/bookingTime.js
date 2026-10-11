// Godziny w strefie gościa; dopisek czasu polskiego, gdy strefa jest inna.
export const viewerTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Warsaw";
const fmt = (iso, tz, o) => new Intl.DateTimeFormat("pl-PL", { timeZone: tz, ...o }).format(new Date(iso));
const HM = { hour: "2-digit", minute: "2-digit", hour12: false };

export const dayKey = (iso, tz = viewerTz()) => fmt(iso, tz, { year: "numeric", month: "2-digit", day: "2-digit" });
export const dayLabel = (iso, tz = viewerTz()) => fmt(iso, tz, { weekday: "long", day: "numeric", month: "long" });
export const timeLabel = (iso, tz = viewerTz()) => fmt(iso, tz, HM);
export const plNote = (iso, tz = viewerTz()) => {
  const pl = fmt(iso, "Europe/Warsaw", { ...HM, day: "numeric", month: "numeric" });
  return pl === fmt(iso, tz, { ...HM, day: "numeric", month: "numeric" }) ? null : `${fmt(iso, "Europe/Warsaw", HM)} czasu polskiego`;
};
export const fullLabel = (iso, tz = viewerTz()) => `${dayLabel(iso, tz)}, ${timeLabel(iso, tz)}`;