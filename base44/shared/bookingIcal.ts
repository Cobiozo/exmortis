// Prywatny kanał iCal dla kalendarza administratora (MUSI 6).
// Tajny adres: token w zapytaniu, w bazie tylko wartość porównywana w czasie stałym.
// W treści wyłącznie rodzaj spotkania i imię — nigdy adresu, odpowiedzi ani danych o zdrowiu.
import { runSql } from "./supabase.ts";
import { safeEqual } from "./booking.ts";
import { icsText, stamp } from "./bookingNotify.ts";

const TOKEN_RE = /^[A-Za-z0-9_-]{20,100}$/;

export async function icalFeed(base44, token) {
  const rows = await runSql(base44, `SELECT ical_token FROM public.bk_settings WHERE id = 1`, true).catch(() => []);
  const stored = rows?.[0]?.ical_token;
  if (!stored || !TOKEN_RE.test(String(token || "")) || !(await safeEqual(token, stored))) {
    return new Response("Nie znaleziono", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  const bookings = await runSql(base44, `SELECT k.ics_uid, k.ics_sequence, k.starts_at, k.ends_at, k.first_name, t.name AS type
    FROM public.bk_bookings k JOIN public.bk_types t ON t.id = k.type_id
    WHERE k.status IN ('POTWIERDZONA','PRZENIESIONA') AND k.ends_at > now() - interval '7 days'
      AND k.starts_at < now() + interval '120 days' ORDER BY k.starts_at LIMIT 1000`, true).catch(() => []);
  const blocks = await runSql(base44, `SELECT id, starts_at, ends_at, note FROM public.bk_blocks
    WHERE NOT disabled AND kind <> 'powtarzalna' AND ends_at > now() - interval '7 days' AND starts_at < now() + interval '120 days'
    ORDER BY starts_at LIMIT 500`, true).catch(() => []);

  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//exmortis//rezerwacje 1:1//PL", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:exmortis · sesje", "REFRESH-INTERVAL;VALUE=DURATION:PT30M", "X-PUBLISHED-TTL:PT30M",
  ];
  for (const b of bookings) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${b.ics_uid}`,
      `SEQUENCE:${Number(b.ics_sequence || 0)}`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(b.starts_at)}`,
      `DTEND:${stamp(b.ends_at)}`,
      `SUMMARY:${icsText(`${b.type || "Spotkanie"}${b.first_name ? ` — ${b.first_name}` : ""}`)}`,
      "END:VEVENT"
    );
  }
  for (const x of blocks) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:block-${x.id}@exmortis`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(x.starts_at)}`,
      `DTEND:${stamp(x.ends_at)}`,
      "SUMMARY:Zajęte",
      "TRANSP:OPAQUE",
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.join("\r\n") + "\r\n", {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="exmortis-sesje.ics"',
      "Cache-Control": "no-store",
    },
  });
}