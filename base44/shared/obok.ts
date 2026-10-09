// Harmonogram odblokowań strefy Obok (czas Europe/Warsaw).
const DAY = 86400000;

function warsawParts(d: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, x.value]));
  return p as Record<string, string>;
}
// Chwila „ymd hh:mm” w Polsce → ms.
export function warsawAt(ymd: string, hm: string) {
  const guess = Date.parse(`${ymd}T${hm}:00Z`);
  const p = warsawParts(new Date(guess));
  const shown = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);
  return guess - (shown - guess);
}
// Pierwsza godzina hh:mm (czas polski) po chwili t.
function nextAt(t: number, hm: string) {
  const p = warsawParts(new Date(t));
  let x = warsawAt(`${p.year}-${p.month}-${p.day}`, hm);
  while (x <= t) x += DAY;
  return x;
}

export const playable = (r: any) => r.status !== "szkic" && !!r.plik_uri;

// Zwraca czas odblokowania (ms) każdego nagrania albo null (nigdy — brak pliku / szkic).
export function unlockTimes(s: any, recs: any[], joinedMs: number | null, planned = false) {
  const out = new Map<string, number | null>();
  const step = s.test_minuty > 0 ? s.test_minuty * 60000 : DAY;
  const sorted = [...recs].sort((a, b) => (a.numer || 0) - (b.numer || 0));
  const n = sorted.length;
  const start = s.edycja_start ? Date.parse(s.edycja_start) : null;
  const edEnd = start != null ? start + (n - 1) * step : null;
  const useEd = start != null && (joinedMs == null || joinedMs <= (edEnd as number) || s.po_edycji === "zamknieta");
  sorted.forEach((r, i) => {
    let t: number;
    if (s.typ === "zbior") t = 0;
    else if (s.typ === "cotygodniowa") t = r.publikacja ? Date.parse(r.publikacja) : Date.parse(r.created_date);
    else if (useEd) t = (start as number) + i * step;
    else if (s.po_edycji === "wszystkie") t = joinedMs || 0;
    else {
      const j = joinedMs || Date.now();
      const first = s.test_minuty > 0 ? j + step : nextAt(j, s.godzina || "20:00");
      t = i === 0 ? j : first + (i - 1) * step;
    }
    out.set(r.id, planned || playable(r) ? t : null);
  });
  return out;
}

export const canJoin = (s: any, now: number, recCount: number) => {
  if (s.status !== "aktywna") return false;
  if (s.po_edycji !== "zamknieta" || !s.edycja_start) return true;
  const step = s.test_minuty > 0 ? s.test_minuty * 60000 : DAY;
  return now <= Date.parse(s.edycja_start) + Math.max(0, recCount - 1) * step;
};