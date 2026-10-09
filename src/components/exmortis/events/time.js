// Formatowanie dat w strefie Europe/Warsaw + linki kalendarzowe (Google, .ics).
import { SITE_URL } from "@/config/site";
const TZ = "Europe/Warsaw";
const fmt = (opts) => new Intl.DateTimeFormat("pl-PL", { timeZone: TZ, ...opts });

export function dateParts(iso) {
  const parts = {};
  for (const p of fmt({ weekday: "long", day: "numeric", month: "long" }).formatToParts(new Date(iso))) {
    parts[p.type] = p.value;
  }
  return { day: parts.day, month: parts.month, weekday: parts.weekday };
}

const MONTH_ABBR = ["STY", "LUT", "MAR", "KWI", "MAJ", "CZE", "LIP", "SIE", "WRZ", "PAŹ", "LIS", "GRU"];
const WEEKDAY_SHORT = {
  poniedziałek: "pon.",
  wtorek: "wt.",
  środa: "śr.",
  czwartek: "czw.",
  piątek: "pt.",
  sobota: "sob.",
  niedziela: "niedz.",
};

// Dane kwadratu daty kafelka: skrót miesiąca, dzień, skrót dnia tygodnia.
export function dateTile(iso) {
  const d = new Date(iso);
  const monthIdx = Number(fmt({ month: "numeric" }).format(d)) - 1;
  const weekday = fmt({ weekday: "long" }).format(d);
  return {
    day: fmt({ day: "numeric" }).format(d),
    month: MONTH_ABBR[monthIdx] || "",
    weekday: WEEKDAY_SHORT[weekday] || "",
  };
}

// Forma spotkania na kartach: tylko „Online” albo „Na żywo”.
export function formatText(format) {
  return format === "Online" ? "Online" : "Na żywo";
}

export function timeText(iso) {
  return fmt({ hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

export function whenText(iso) {
  return `${fmt({ weekday: "long", day: "numeric", month: "long" }).format(new Date(iso))} · ${timeText(iso)}`;
}

// Pełna data z godziną, np. „czwartek, 3 grudnia · 20:00”.
export function plWhen(iso) {
  return whenText(iso);
}

// „czwartek · 3 grudnia · 20:00” (sep) — data z dniem tygodnia, bez roku.
export function plWhenFull(iso, sep = ", ") {
  const d = new Date(iso);
  return `${fmt({ weekday: "long" }).format(d)}${sep}${fmt({ day: "numeric", month: "long" }).format(d)}${sep}${timeText(iso)}`;
}

export function durationText(minutes) {
  const m = Number(minutes) || 60;
  if (m % 60 === 0) return `${m / 60} godz.`;
  const h = Math.floor(m / 60);
  return h > 0 ? `${h} godz. ${m % 60} min` : `${m} min`;
}

export function priceText(price) {
  return Number(price) > 0 ? `${Number(price)} zł` : "bezpłatnie";
}

export function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function icsStamp(d) {
  return new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function icsEsc(s) {
  return String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

export function googleCalendarUrl(ev) {
  const start = new Date(ev.start_datetime);
  const end = new Date(start.getTime() + (Number(ev.duration_minutes) || 60) * 60000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${icsStamp(start)}/${icsStamp(end)}`,
    details: ev.subtitle || "",
    location: ev.format === "Online" ? `${SITE_URL}/spotkania/${ev.slug}/dolacz` : ev.location || "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// Plik .ics budowany na serwerze z aktualnych danych spotkania (stały UID, stały adres dołączenia).
export async function downloadIcs(ev) {
  const { base44 } = await import("@/api/base44Client");
  const { ics } = (await base44.functions.invoke("eventsPublic", { action: "ics", slug: ev.slug })).data;
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "exmortis-spotkanie.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}