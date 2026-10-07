import { sendMail } from "./smtp.ts";

// Wspólne narzędzia modułu Spotkań: daty w strefie Europe/Warsaw, pliki .ics
// i szablony e-maili (potwierdzenia, przypomnienia, nagrania, lista rezerwowa).

export const APP_URL = "https://exmortis-return-path.base44.app";
const CANCEL_URL = `${APP_URL}/functions/eventsCancel`;

const warsawFmt = (opts) => new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", ...opts });

export function plDate(value) {
  return warsawFmt({ weekday: "long", day: "numeric", month: "long" }).format(new Date(value));
}

export function plTime(value) {
  return warsawFmt({ hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

export function plWhen(value) {
  return `${plDate(value)} · ${plTime(value)}`;
}

function escHtml(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function icsStamp(date) {
  return new Date(date).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function buildIcs(ev) {
  const start = new Date(ev.start_datetime);
  const end = new Date(start.getTime() + (Number(ev.duration_minutes) || 60) * 60000);
  const esc = (s) => escHtml(s).replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EXMORTIS//Spotkania//PL",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${ev.id}@exmortis`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${esc(ev.title)}`,
    `DESCRIPTION:${esc(ev.subtitle || "")}`,
    `LOCATION:${esc(ev.location || "")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function icsAttachment(ev) {
  return {
    filename: "exmortis-spotkanie.ics",
    content: buildIcs(ev),
    contentType: "text/calendar; charset=utf-8",
  };
}

function coverOf(ev) {
  let c = ev?.cover;
  if (typeof c === "string") { try { c = JSON.parse(c); } catch { c = null; } }
  return c && typeof c === "object" ? c : null;
}

// Nagłówek e-maila z okładką spotkania (z tekstem alternatywnym — mail czytelny bez obrazów).
function shell(ev, content) {
  const c = coverOf(ev);
  const img = c?.crops?.mail
    ? `<img src="${escHtml(c.crops.mail)}" alt="${escHtml(c.alt || ev.title)}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;margin:0 0 24px;${ev.status === "Odwołane" ? "filter:grayscale(1);" : ""}" />`
    : "";
  return `<div style="background:#0A0A0B;padding:32px;font-family:Georgia,serif;color:#E2E2E2;">
    <p style="letter-spacing:4px;color:#C9A24A;font-size:13px;">EXMORTIS</p>${img}
    ${content}
    <p style="color:#8A8A8C;font-size:12px;line-height:1.7;margin-top:28px;">exmortis to mentoring, nie terapia. Jeśli jest Ci bardzo ciężko: 116 123 · 800 70 2222 (całą dobę, bezpłatnie) · w zagrożeniu życia 112.</p>
    <p style="color:#5C5C5E;font-size:12px;letter-spacing:2px;margin-top:32px;">WRACAM Z SIEBIE · UCZĘ WRACAĆ</p>
  </div>`;
}

function cancelLink(token) {
  return `<p style="margin-top:28px;font-size:12px;"><a href="${CANCEL_URL}?token=${token}" style="color:#8A8A8C;">Nie mogę przyjść — zwalniam miejsce</a></p>`;
}

function meetingLine(ev) {
  return `<p style="color:#C9A24A;letter-spacing:1px;">${escHtml(plWhen(ev.start_datetime))} · ${escHtml(ev.format || "")}</p>
    <p style="color:#8A8A8C;">${escHtml(ev.location || "")}</p>`;
}

function joinBlock(ev) {
  if (ev.format === "Online" && ev.join_link) {
    return `<p style="margin-top:20px;">Link do spotkania:<br /><a href="${escHtml(ev.join_link)}" style="color:#C9A24A;">${escHtml(ev.join_link)}</a></p>`;
  }
  if (ev.format === "Online" && ev.external_url) {
    return `<p style="margin-top:20px;"><a href="${escHtml(ev.external_url)}" style="color:#C9A24A;">Dołącz do spotkania tutaj</a></p>`;
  }
  return `<p style="margin-top:20px;color:#8A8A8C;">${escHtml(ev.location || "")} — przyjdź kilka minut wcześniej.</p>`;
}

// Potwierdzenie zapisu (z załączonym plikiem .ics).
export async function sendConfirmationMail(smtp, ev, reg) {
  const waitlist = reg.status === "Lista rezerwowa";
  const lead = waitlist
    ? `${escHtml(reg.first_name)}, wszystkie miejsca na «${escHtml(ev.title)}» są już zajęte. Zapisałem Cię na listę rezerwową — dam znać, jeśli ktoś zrezygnuje.`
    : `${escHtml(reg.first_name)}, zapiszuję Cię na «${escHtml(ev.title)}». ${ev.format === "Online" ? "Link do spotkania masz poniżej i w przypomnieniu przed startem." : "Czekam na Ciebie na miejscu."}`;
  await sendMail(smtp, {
    to: reg.email,
    subject: `EXMORTIS · ${waitlist ? "Lista rezerwowa" : "Zapis potwierdzony"} — ${ev.title}`,
    html: shell(ev, 
      `<h1 style="font-size:24px;">${waitlist ? "Jesteś na liście rezerwowej" : "Jesteś zapisany/a"}</h1>${meetingLine(ev)}` +
        `<p style="line-height:1.7;">${lead}</p>` +
        (ev.what_registered ? `<p style="color:#8A8A8C;font-size:13px;">Co dostają zapisani: ${escHtml(ev.what_registered)}</p>` : "") +
        (waitlist ? "" : joinBlock(ev)) +
        `<p style="color:#8A8A8C;font-size:13px;">Spotkanie masz w załączonym pliku kalendarza (.ics).</p>` +
        cancelLink(reg.cancel_token)
    ),
    attachments: [icsAttachment(ev)],
  });
}

// Odwołanie spotkania: przeprosiny, powód, link do listy spotkań.
export async function sendCancelledMail(smtp, ev, reg, reason) {
  await sendMail(smtp, {
    to: reg.email,
    subject: `EXMORTIS · Odwołane — ${ev.title}`,
    html: shell(ev, 
      `<h1 style="font-size:24px;">To spotkanie się nie odbędzie</h1>${meetingLine(ev)}` +
        `<p style="line-height:1.7;">${escHtml(reg.first_name)}, przepraszam — spotkanie «${escHtml(ev.title)}» zostało odwołane.</p>` +
        (reason ? `<p style="line-height:1.7;color:#8A8A8C;">${escHtml(reason)}</p>` : "") +
        `<p style="margin-top:20px;"><a href="${APP_URL}/spotkania" style="color:#C9A24A;">Zobacz kolejne terminy</a></p>` +
        cancelLink(reg.cancel_token)
    ),
  });
}

// Przypomnienie 24 h lub 1 h przed spotkaniem (z linkiem dołączania) —
// albo wysyłane ręcznie z panelu (kind === "now").
export async function sendReminderMail(smtp, ev, reg, kind) {
  const head = kind === "1h" ? "Za godzinę się widzimy" : kind === "now" ? "Do zobaczenia wkrótce" : "Jutro się widzimy";
  const lead =
    kind === "1h"
      ? `${escHtml(reg.first_name)}, za godzinę spotykamy się na «${escHtml(ev.title)}». Zostaw wszystko i po prostu przyjdź.`
      : kind === "now"
        ? `${escHtml(reg.first_name)}, przypominam o spotkaniu «${escHtml(ev.title)}» — ${escHtml(plWhen(ev.start_datetime))}. Czekam na Ciebie.`
        : `${escHtml(reg.first_name)}, jutro o ${escHtml(plTime(ev.start_datetime))} spotykamy się na «${escHtml(ev.title)}». To krótkie przypomnienie — nic nie musisz robić, tylko przyjść.`;
  await sendMail(smtp, {
    to: reg.email,
    subject: `EXMORTIS · ${head} — ${ev.title}`,
    html: shell(ev, `<h1 style="font-size:24px;">${head}</h1>${meetingLine(ev)}<p style="line-height:1.7;">${lead}</p>${joinBlock(ev)}${cancelLink(reg.cancel_token)}`),
  });
}

// Podziękowanie dzień po spotkaniu, z linkiem do nagrania.
export async function sendRecordingMail(smtp, ev, reg, inviteHtml) {
  await sendMail(smtp, {
    to: reg.email,
    subject: `EXMORTIS · Dziękuję, że byłeś/byłaś — ${ev.title}`,
    html: shell(ev, 
      `<h1 style="font-size:24px;">Dziękuję, że byłeś/byłaś</h1>` +
        `<p style="line-height:1.7;">${escHtml(reg.first_name)}, nagranie ze spotkania «${escHtml(ev.title)}» czeka na Ciebie:</p>` +
        `<p><a href="${escHtml(ev.recording_url)}" style="color:#C9A24A;">Obejrzyj nagranie</a></p>` +
        inviteHtml
    ),
  });
}

// Awans z listy rezerwowej po zwolnieniu miejsca.
export async function sendSpotFreedMail(smtp, ev, reg) {
  await sendMail(smtp, {
    to: reg.email,
    subject: `EXMORTIS · Zwolniło się miejsce — ${ev.title}`,
    html: shell(ev, 
      `<h1 style="font-size:24px;">Zwolniło się miejsce</h1>${meetingLine(ev)}` +
        `<p style="line-height:1.7;">${escHtml(reg.first_name)}, ktoś zrezygnował — miejsce na «${escHtml(ev.title)}» jest Twoje. Do zobaczenia na spotkaniu.</p>` +
        joinBlock(ev) +
        cancelLink(reg.cancel_token)
    ),
  });
}

// Wiadomość od administratora do zapisanych (np. zmiana godziny).
export async function sendBroadcastMail(smtp, ev, reg, subject, text) {
  await sendMail(smtp, {
    to: reg.email,
    subject,
    html: shell(ev, 
      `<h1 style="font-size:24px;">${escHtml(ev.title)}</h1>` +
        `<p style="line-height:1.7;">${escHtml(reg.first_name)},</p>` +
        `<div style="line-height:1.7;">${escHtml(text).replace(/\r?\n/g, "<br/>")}</div>` +
        cancelLink(reg.cancel_token)
    ),
  });
}