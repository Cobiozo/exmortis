import { wawToday } from "./eventForm";

// Szybkie wybory dat (liczone od dzisiejszej daty w Polsce).
const iso = (d) => d.toISOString().slice(0, 10);
const base = () => { const t = wawToday().date; return new Date(`${t}T12:00:00Z`); };
const add = (d, n) => new Date(d.getTime() + n * 864e5);

export function quickDates() {
  const today = base();
  const thu = add(today, ((4 - today.getUTCDay() + 7) % 7) || 7);
  const firstThu = (y, m) => { const d = new Date(Date.UTC(y, m, 1, 12)); return add(d, (4 - d.getUTCDay() + 7) % 7); };
  let ft = firstThu(today.getUTCFullYear(), today.getUTCMonth());
  if (ft < today) ft = firstThu(today.getUTCFullYear(), today.getUTCMonth() + 1);
  return [["Dziś", iso(today)], ["Jutro", iso(add(today, 1))], ["Najbliższy czwartek", iso(thu)], ["Pierwszy czwartek miesiąca", iso(ft)]];
}

export const QUICK_TIMES = ["19:00", "19:30", "20:00", "20:30"];

const F = (o) => new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", ...o });
export function termSummary(date, time, minutes, startDate) {
  if (!date || !time || !startDate) return "";
  const end = new Date(startDate.getTime() + (Number(minutes) || 60) * 60000);
  const day = F({ weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(startDate);
  return `${day}, ${time}–${F({ hour: "2-digit", minute: "2-digit", hour12: false }).format(end)} (czas polski)`;
}