// Formatowanie dat w strefie Europe/Warsaw + linki kalendarzowe (Google, .ics).
import { SITE_URL } from "@/config/site";
const PL = "Europe/Warsaw";
// Strefa urządzenia gościa (?strefa=… tylko do testów). Godziny zawsze z UTC w bazie — bez ręcznych przesunięć.
export const viewerTz = () => {
  const q = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("strefa");
  try { if (q) { new Intl.DateTimeFormat("pl-PL", { timeZone: q }); return q; } } catch {}
  return Intl.DateTimeFormat().resolvedOptions().timeZone || PL;
};
const TZ = viewerTz();
const fmt = (opts) => new Intl.DateTimeFormat("pl-PL", { timeZone: TZ, ...opts });
const stamp = (iso, tz) => new Intl.DateTimeFormat("sv-SE", { timeZone: tz, dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
const hm = (iso, tz) => new Intl.DateTimeFormat("pl-PL", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
// Gość „gdzie indziej” = w chwili spotkania jego zegar pokazuje inną datę/godzinę niż Warszawa.
const abroad = (iso) => stamp(iso, TZ) !== stamp(iso, PL);

// „20:00 czasu polskiego” — tylko dla gościa spoza strefy Warszawy.
export function warsawNote(iso) {
  return iso && abroad(iso) ? `${hm(iso, PL)} czasu polskiego` : null;
}

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
  return hm(iso, TZ) + (abroad(iso) ? " (u Ciebie)" : "");
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


// Adres dołączenia do opisu w kalendarzu: osobisty (po zapisie) albo ogólny strony wydarzenia.
const joinHref = (ev, joinUrl) => (joinUrl ? (/^https?:/.test(joinUrl) ? joinUrl : `${SITE_URL}${joinUrl}`) : `${SITE_URL}/spotkania/${ev.slug}/dolacz`);
const calDetails = (ev, joinUrl) => (ev.format === "Online"
  ? [ev.subtitle || "", `Dołącz do spotkania (pokój otwiera się kilka minut przed startem):\n${joinHref(ev, joinUrl)}`].filter(Boolean).join("\n\n")
  : ev.subtitle || "");
const calEnd = (ev) => new Date(new Date(ev.start_datetime).getTime() + (Number(ev.duration_minutes) || 60) * 60000);

// Spotkanie online: bez pola „miejsce” — każda wartość w nim daje w kalendarzu przycisk „Trasa” (Mapy Google).
export function googleCalendarUrl(ev, joinUrl = null) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${icsStamp(ev.start_datetime)}/${icsStamp(calEnd(ev))}`,
    details: calDetails(ev, joinUrl),
    ctz: PL,
  });
  if (ev.format !== "Online" && ev.location) params.set("location", ev.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// Outlook (konto Microsoft: outlook.com / Hotmail / Microsoft 365 w przeglądarce).
export function outlookCalendarUrl(ev, joinUrl = null) {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: ev.title,
    startdt: new Date(ev.start_datetime).toISOString(),
    enddt: calEnd(ev).toISOString(),
    body: calDetails(ev, joinUrl),
  });
  if (ev.format !== "Online" && ev.location) params.set("location", ev.location);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

// Apple / inne kalendarze: plik .ics z serwera pod zwykłym adresem — iPhone i Android od razu proponują
// „Dodaj do kalendarza”, komputer otwiera go w swoim kalendarzu. t — osobisty klucz dołączenia (po zapisie).
export function icsUrl(ev, t = null) {
  const q = new URLSearchParams({ action: "ics", slug: ev.slug, ...(t ? { t } : {}) });
  return `${SITE_URL}/functions/eventsPublic?${q.toString()}`;
}

// Plik .ics budowany na serwerze z aktualnych danych spotkania (stały UID, stały adres dołączenia).
export async function downloadIcs(ev, t = null) {
  const { base44 } = await import("@/api/base44Client");
  // t — osobisty klucz dołączenia (po zapisie): w kalendarzu ląduje wtedy osobisty link.
  const { ics } = (await base44.functions.invoke("eventsPublic", { action: "ics", slug: ev.slug, ...(t ? { t } : {}) })).data;
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "exmortis-spotkanie.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}