import { useEffect, useState } from "react";
import useSiteSettings from "@/lib/useSiteSettings";

// Daty wpisywane w panelu („2026-10-16T00:00” lub „2026-10-16 00:00”) = czas polski, niezależnie od strefy widza.
const WAW = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Warsaw", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
const parts = (t) => { const o = {}; for (const p of WAW.formatToParts(new Date(t))) o[p.type] = p.value; return o; };

export function parseWaw(s) {
  const v = String(s || "").trim();
  if (!v) return null;
  if (/[zZ]|[+-]\d\d:?\d\d$/.test(v)) { const d = new Date(v); return isNaN(d) ? null : d; }
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/);
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
  const off = (t) => { const p = parts(t); return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - t; };
  let t = guess - off(guess); t = guess - off(t);
  return new Date(t);
}

// „16 października” w czasie polskim.
export const plDay = (d) => d ? new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", day: "numeric", month: "long" }).format(d) : "";

// true do podanej chwili; przełącza się sam, gdy strona jest otwarta w momencie zmiany.
// Liczone wg zegara serwera (poprawka z ustawień strony), nie zegara urządzenia gościa.
export function useBefore(s) {
  const off = useSiteSettings()?.offset || 0;
  const at = parseWaw(s)?.getTime() ?? null;
  const [, tick] = useState(0);
  useEffect(() => {
    if (at === null) return;
    const left = at - (Date.now() + off);
    if (left <= 0 || left > 2 ** 31 - 1) return;
    const id = setTimeout(() => tick((x) => x + 1), left + 500);
    return () => clearTimeout(id);
  }, [at, off]);
  return at !== null && Date.now() + off < at;
}
