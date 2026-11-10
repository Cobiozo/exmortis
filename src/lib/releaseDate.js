// Data premiery produktu „wkrótce”: „24 listopada” (rok tylko, gdy inny niż bieżący).
export function releaseDay(p) {
  if (p?.status !== "wkrótce" || !p?.release_at) return "";
  const d = new Date(p.release_at);
  if (isNaN(d)) return "";
  const tz = { timeZone: "Europe/Warsaw" };
  const sameYear = new Intl.DateTimeFormat("pl-PL", { ...tz, year: "numeric" }).format(d) ===
    new Intl.DateTimeFormat("pl-PL", { ...tz, year: "numeric" }).format(new Date());
  return d.toLocaleDateString("pl-PL", { ...tz, day: "numeric", month: "long", ...(sameYear ? {} : { year: "numeric" }) });
}

// „Dostępny od 24 listopada” albo „Wkrótce”, gdy daty nie ustawiono.
export const soonLabel = (p) => (releaseDay(p) ? `Dostępny od ${releaseDay(p)}` : "Wkrótce");