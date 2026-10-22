// Powiadomienia rezerwacji 1:1 — wspólne dla potwierdzeń, przypomnień, przeniesień i anulowań.
// Wysyłka idzie wyłącznie istniejącą kolejką (shared/smtp.ts → MailQueue), więc nic nie ginie,
// gdy wysyłka e-mail jest jeszcze nieskonfigurowana: mail czeka jako „kolejka”.
import { runSql, escStr } from "./supabase.ts";
import { sendMail, adminTo } from "./smtp.ts";
import { loadAppUrl } from "./settings.ts";
import { sha256hex, randomToken } from "./booking.ts";

// ---------- tekst i formaty ----------

const ENT = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ENT[c]);
const unh = (s) => String(s ?? "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

export const icsText = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
export const stamp = (d) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

// Czas polski zawsze; czas gościa dopisujemy tylko, gdy różni się od polskiego.
export const plFull = (iso) =>
  new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export function localLabel(iso, tz) {
  if (!tz) return "";
  try {
    const opts = { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" };
    const g = new Intl.DateTimeFormat("pl-PL", { ...opts, timeZone: tz }).format(new Date(iso));
    const pl = new Intl.DateTimeFormat("pl-PL", { ...opts, timeZone: "Europe/Warsaw" }).format(new Date(iso));
    return g === pl ? "" : `${g} Twojego czasu`;
  } catch {
    return "";
  }
}

// ---------- treści e-maili (edytowalne w panelu) ----------

export const DEFAULT_TEXTS = {
  potwierdzenie: {
    subject: "Potwierdzenie: {{rodzaj}} — {{termin}}",
    body: `<p style="line-height:1.7;margin:0 0 14px;">{{imie}}, Twój termin jest zarezerwowany.</p>
<p style="color:#C9A24A;font-size:19px;margin:0 0 6px;">{{rodzaj}}</p>
<p style="margin:0 0 4px;">{{termin}}</p>
<p style="color:#8A8A8C;font-size:13px;margin:0 0 18px;">{{termin_lokalny}}</p>
<p style="margin:0 0 18px;">{{zoom}}</p>
<p style="margin:0 0 18px;">{{przenies}} &nbsp;·&nbsp; {{anuluj}}</p>
<p style="color:#8A8A8C;font-size:13px;margin:0;">W załączniku jest plik do Twojego kalendarza. Link do spotkania działa od 15 minut przed terminem.</p>`,
  },
  przypomnienie24: {
    subject: "Jutro: {{rodzaj}} — {{termin}}",
    body: `<p style="line-height:1.7;margin:0 0 14px;">{{imie}}, przypominam o jutrzejszym spotkaniu.</p>
<p style="color:#C9A24A;margin:0 0 4px;">{{rodzaj}}</p>
<p style="margin:0 0 4px;">{{termin}}</p>
<p style="color:#8A8A8C;font-size:13px;margin:0 0 18px;">{{termin_lokalny}}</p>
<p style="margin:0 0 18px;">{{zoom}}</p>
<p style="margin:0;">{{przenies}} &nbsp;·&nbsp; {{anuluj}}</p>`,
  },
  przypomnienie1: {
    subject: "Za godzinę: {{rodzaj}} — {{termin}}",
    body: `<p style="line-height:1.7;margin:0 0 14px;">{{imie}}, spotykamy się za godzinę.</p>
<p style="margin:0 0 18px;">{{zoom}}</p>
<p style="color:#8A8A8C;font-size:13px;margin:0;">{{termin}} · {{termin_lokalny}}</p>`,
  },
  przeniesienie: {
    subject: "Nowy termin: {{rodzaj}} — {{termin}}",
    body: `<p style="line-height:1.7;margin:0 0 14px;">{{imie}}, termin został przeniesiony.</p>
<p style="color:#C9A24A;margin:0 0 4px;">{{rodzaj}}</p>
<p style="margin:0 0 4px;">{{termin}}</p>
<p style="color:#8A8A8C;font-size:13px;margin:0 0 18px;">{{termin_lokalny}}</p>
<p style="margin:0 0 18px;">{{zoom}}</p>
<p style="margin:0;">{{przenies}} &nbsp;·&nbsp; {{anuluj}}</p>`,
  },
  anulowanie: {
    subject: "Anulowane: {{rodzaj}} — {{termin}}",
    body: `<p style="line-height:1.7;margin:0 0 14px;">{{imie}}, spotkanie zostało anulowane.</p>
<p style="color:#C9A24A;margin:0 0 4px;">{{rodzaj}}</p>
<p style="margin:0;">{{termin}}</p>`,
  },
};

export async function mailTexts(base44) {
  const r = await runSql(base44, `SELECT mail_texts FROM public.bk_settings WHERE id = 1`, true).catch(() => []);
  const t = r?.[0]?.mail_texts || {};
  const out = {};
  for (const k of Object.keys(DEFAULT_TEXTS)) {
    out[k] = {
      subject: String(t?.[k]?.subject || "").trim() || DEFAULT_TEXTS[k].subject,
      body: String(t?.[k]?.body || "").trim() || DEFAULT_TEXTS[k].body,
    };
  }
  return out;
}

const shell = (inner) => `<div style="background:#0A0A0B;padding:32px;font-family:Georgia,serif;color:#E2E2E2;">
  <p style="letter-spacing:4px;color:#C9A24A;font-size:13px;margin:0 0 18px;">EXMORTIS</p>
  ${inner}
  <p style="color:#5C5C5E;font-size:12px;letter-spacing:2px;margin-top:32px;">WRACAM Z SIEBIE · UCZĘ WRACAĆ</p>
</div>`;

const fill = (tpl, v) => String(tpl || "").replace(/\{\{(\w+)\}\}/g, (_, k) => (k in v ? v[k] : ""));

// ---------- wydarzenie iCal ----------

export function icsAttach(b, method) {
  const cancelled = method === "CANCEL";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//exmortis//rezerwacje 1:1//PL",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${b.ics_uid}`,
    `SEQUENCE:${Number(b.ics_sequence || 0)}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(b.starts_at)}`,
    `DTEND:${stamp(b.ends_at)}`,
    `SUMMARY:${icsText(`${b.type || ""} — ${b.first_name || ""}`.trim())}`,
    `DESCRIPTION:${icsText(b.zoom_link ? `Spotkanie online: ${b.zoom_link}` : "Spotkanie online — link pojawi się przed terminem.")}`,
    `ORGANIZER;CN=exmortis:mailto:${b.organizer || "kontakt@exmortis.pl"}`,
    b.email ? `ATTENDEE;CN=${icsText(b.first_name || "")};RSVP=TRUE:mailto:${b.email}` : null,
    `STATUS:${cancelled ? "CANCELLED" : "CONFIRMED"}`,
    cancelled ? null : "BEGIN:VALARM",
    cancelled ? null : "TRIGGER:-PT30M",
    cancelled ? null : "ACTION:DISPLAY",
    cancelled ? null : "DESCRIPTION:Spotkanie",
    cancelled ? null : "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return {
    filename: cancelled ? "spotkanie-anulowane.ics" : "spotkanie.ics",
    content: lines.join("\r\n") + "\r\n",
    contentType: `text/calendar; method=${method}; charset=UTF-8`,
  };
}

// ---------- odczyt i wysyłka ----------

export async function loadBooking(base44, id) {
  const r = await runSql(base44, `SELECT k.id, k.email, k.first_name, k.starts_at, k.ends_at, k.status, k.client_tz,
      k.ics_uid, k.ics_sequence, t.name AS type, t.zoom_link, t.slug
    FROM public.bk_bookings k JOIN public.bk_types t ON t.id = k.type_id WHERE k.id = ${escStr(id)}::uuid`, true).catch(() => []);
  const b = r?.[0];
  if (b) b.organizer = await adminTo(base44).catch(() => null);
  return b || null;
}

export async function mailVars(base44, b, token) {
  const url = await loadAppUrl(base44);
  const manage = token ? `${url}/rezerwacja/zarzadzaj#t=${token}` : null;
  return {
    imie: h(b.first_name || ""),
    rodzaj: h(b.type || ""),
    termin: h(plFull(b.starts_at)),
    termin_lokalny: h(localLabel(b.starts_at, b.client_tz)),
    zoom: b.zoom_link ? `<a href="${h(b.zoom_link)}" style="color:#C9A24A;">Wejdź na spotkanie</a>` : "Link do spotkania pojawi się przed terminem.",
    przenies: manage ? `<a href="${h(manage)}" style="color:#C9A24A;">Przenieś termin</a>` : "",
    anuluj: manage ? `<a href="${h(manage)}&a=anuluj" style="color:#C9A24A;">Anuluj spotkanie</a>` : "",
  };
}

// Ślad w kolejce: rodzaj, kiedy i z jakim skutkiem (bez treści i bez danych z formularza).
async function trace(base44, bookingId, kind, res) {
  await runSql(base44, `INSERT INTO public.bk_notifications (booking_id, kind, send_at, idem_key, status, sent_at)
    VALUES (${escStr(bookingId)}::uuid, ${escStr(kind)}, now(), ${escStr(`${bookingId}:${kind}:log:${Date.now()}`)},
      ${escStr(res === "wyslany" ? "wyslane" : "zaplanowane")}, now())
    ON CONFLICT (idem_key) DO NOTHING`).catch(() => {});
}

// Świeży link do zarządzania (w bazie tylko skrót) — dla przypomnień i zmian z panelu.
export async function mintManageToken(base44, b) {
  const token = randomToken();
  await runSql(base44, `INSERT INTO public.bk_tokens (purpose, token_hash, owner_email, booking_id, expires_at)
    VALUES ('zarzadzaj', ${escStr(await sha256hex(token))}, ${escStr(b.email || null)}, ${escStr(b.id)}::uuid,
      ${escStr(new Date(new Date(b.ends_at).getTime() + 30 * 864e5).toISOString())})`).catch(() => {});
  return token;
}

// Potwierdzenie, przeniesienie i anulowanie: treść z panelu, iCal w załączniku.
export async function sendBookingMail(base44, { kind, booking, token }) {
  const texts = await mailTexts(base44);
  const tpl = texts[kind] || DEFAULT_TEXTS[kind];
  const link = kind === "anulowanie" ? null : token || (await mintManageToken(base44, booking));
  const v = await mailVars(base44, booking, link);
  const withIcs = kind === "potwierdzenie" || kind === "przeniesienie" || kind === "anulowanie";
  const res = await sendMail(base44, {
    to: booking.email,
    subject: unh(fill(tpl.subject, v)),
    html: shell(fill(tpl.body, v)),
    kind: `rez_${kind}`,
    ref: booking.id,
    attachments: withIcs ? [icsAttach(booking, kind === "anulowanie" ? "CANCEL" : "REQUEST")] : [],
    // Przypomnienie starsze niż termin nie ma po co wychodzić — także przy późniejszym opróżnianiu kolejki.
    waznyDo: kind === "przypomnienie1" || kind === "przypomnienie24" ? booking.starts_at : undefined,
  });
  await trace(base44, booking.id, kind, res);
  return res;
}

// Do mnie: zwięzłe powiadomienie z plikiem iCal (wpis na pulpicie to rejestr bk_log).
async function sendAdminMail(base44, b) {
  const to = await adminTo(base44).catch(() => null);
  if (!to) return null;
  const html = `<div style="background:#0A0A0B;padding:28px;font-family:Georgia,serif;color:#E2E2E2;">
    <p style="letter-spacing:4px;color:#C9A24A;font-size:12px;margin:0 0 14px;">EXMORTIS · REZERWACJE</p>
    <p style="margin:0 0 6px;font-size:18px;">${h(b.type)} — ${h(plFull(b.starts_at))}</p>
    <p style="color:#8A8A8C;margin:0 0 4px;">${h(b.first_name)} · ${h(b.email)}</p>
    <p style="color:#8A8A8C;margin:0;">Źródło: ${b.source === "admin" ? "umówione z panelu" : "zapisała się sama"}</p>
  </div>`;
  return sendMail(base44, { to, subject: `Nowa rezerwacja: ${b.type} — ${plFull(b.starts_at)}`, html, kind: "rez_admin", ref: b.id, attachments: [icsAttach(b, "REQUEST")] });
}

// ---------- kolejka przypomnień ----------

const REMIND = [["przypomnienie24", 24 * 3600e3], ["przypomnienie1", 3600e3]];

export async function scheduleNotifications(base44, b) {
  const seq = Number(b.ics_sequence || 0);
  for (const [kind, off] of REMIND) {
    const sendAt = new Date(new Date(b.starts_at).getTime() - off);
    if (sendAt.getTime() <= Date.now()) continue;
    await runSql(base44, `INSERT INTO public.bk_notifications (booking_id, kind, send_at, idem_key, status)
      VALUES (${escStr(b.id)}::uuid, ${escStr(kind)}, ${escStr(sendAt.toISOString())}, ${escStr(`${b.id}:${kind}:${seq}`)}, 'zaplanowane')
      ON CONFLICT (idem_key) DO NOTHING`).catch(() => {});
  }
}

// Stare przypomnienia anulowane: nie wyjdą już nigdy.
export async function dropPending(base44, bookingId) {
  await runSql(base44, `UPDATE public.bk_notifications SET status = 'pominiete'
    WHERE booking_id = ${escStr(bookingId)}::uuid AND status = 'zaplanowane'`).catch(() => {});
}

// Nowa rezerwacja (klient albo „Umów klienta”): potwierdzenie + przypomnienia + mail do mnie.
export async function onBookingCreated(base44, bookingId, token, source) {
  const b = await loadBooking(base44, bookingId);
  if (!b) return null;
  b.source = source;
  await scheduleNotifications(base44, b);
  await sendBookingMail(base44, { kind: "potwierdzenie", booking: b, token });
  await sendAdminMail(base44, b);
  return b;
}

// Przeniesienie: ten sam UID, SEQUENCE + 1, przypomnienia od nowego terminu.
export async function onBookingMoved(base44, bookingId) {
  const b = await loadBooking(base44, bookingId);
  if (!b) return null;
  await dropPending(base44, bookingId);
  await scheduleNotifications(base44, b);
  await sendBookingMail(base44, { kind: "przeniesienie", booking: b, token: null });
  return b;
}

export async function onBookingCancelled(base44, bookingId) {
  const b = await loadBooking(base44, bookingId);
  if (!b) return null;
  await dropPending(base44, bookingId);
  await sendBookingMail(base44, { kind: "anulowanie", booking: b, token: null });
  return b;
}

// Przypomnienia wychodzą tylko dla aktualnego terminu, w oknie i nie spóźnione.
export async function runReminders(base44) {
  // Zapytanie zwraca już wszystkie pola potrzebne treści i plikowi .ics — dzięki temu nie ma
  // osobnego odczytu na każdą wiadomość (wcześniej do 40 rund do bazy na jedno uruchomienie).
  const due = await runSql(base44, `SELECT n.id AS nid, n.kind, n.send_at, k.id AS id, k.starts_at, k.ends_at,
      k.status, k.ics_uid, k.ics_sequence, k.first_name, k.email, k.client_tz, t.name AS type, t.zoom_link, t.slug
    FROM public.bk_notifications n JOIN public.bk_bookings k ON k.id = n.booking_id JOIN public.bk_types t ON t.id = k.type_id
    WHERE n.status = 'zaplanowane' AND n.kind IN ('przypomnienie24','przypomnienie1') AND n.send_at <= now() + interval '1 minute'
    ORDER BY n.send_at LIMIT 40`, true).catch(() => []);
  let sent = 0, skipped = 0;
  const organizer = due.length ? await adminTo(base44).catch(() => null) : null;   // adres nadawcy raz na partię
  for (const r of due) {
    const off = r.kind === "przypomnienie24" ? 24 * 3600e3 : 3600e3;
    const expected = new Date(r.starts_at).getTime() - off;
    const late = Date.now() - new Date(r.send_at).getTime() > 20 * 60e3;
    const stale = Math.abs(expected - new Date(r.send_at).getTime()) > 60000;
    if (r.status !== "POTWIERDZONA" || new Date(r.starts_at).getTime() <= Date.now() || stale || late) {
      await runSql(base44, `UPDATE public.bk_notifications SET status = 'pominiete' WHERE id = ${r.nid}`);
      skipped++;
      continue;
    }
    const b = { id: r.id, email: r.email, first_name: r.first_name, starts_at: r.starts_at, ends_at: r.ends_at,
      status: r.status, client_tz: r.client_tz, ics_uid: r.ics_uid, ics_sequence: r.ics_sequence,
      type: r.type, zoom_link: r.zoom_link, slug: r.slug, organizer };
    const res = await sendBookingMail(base44, { kind: r.kind, booking: b, token: null });
    await runSql(base44, `UPDATE public.bk_notifications SET status = ${escStr(res === "wyslany" ? "wyslane" : "zaplanowane")}, sent_at = now() WHERE id = ${r.nid}`);
    sent++;
  }
  return { sent, skipped };
}