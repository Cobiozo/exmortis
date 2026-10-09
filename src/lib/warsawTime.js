// Konwersje „data i godzina w Polsce” ↔ ISO (poprawnie także przy zmianie czasu).
const parts = (d) => Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).map((p) => [p.type, p.value]));

export function isoToWarsawLocal(iso) {
  const p = parts(new Date(iso));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function warsawLocalToIso(local) {
  const guess = new Date(`${local}:00Z`);
  const shown = new Date(`${isoToWarsawLocal(guess)}:00Z`);
  return new Date(guess.getTime() - (shown.getTime() - guess.getTime())).toISOString();
}

export const fmtWarsaw = (iso) => new Date(iso).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });