// Mail po spotkaniu online — następnego dnia rano (od 9:00 czasu polskiego), bez nagrania:
// spotkania exmortis są tylko na żywo. Dwie wersje:
//  • „obecny” — osoba weszła do pokoju przez swój osobisty link (registrations.joined_at) albo ma status Obecny;
//  • „nieobecny” — zapisała się, ale nie dołączyła.
// Każda prowadzi do jednego następnego kroku: najbliższe spotkanie albo test.
// Przełącznik: app_settings „po_spotkaniu” {wlaczone} (domyślnie włączone).
import { runSql, escStr } from "./supabase.ts";
import { getSetting, saveSetting } from "./settings.ts";
import { emailButton } from "./emailLayout.ts";

const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const P = (t) => `<p style="margin:0 0 18px;">${t}</p>`;
const LABEL = (t) => `<p style="margin:0 0 10px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:3px;color:#C9A24A;">${t}</p>`;
const SIGN = `<p style="margin:30px 0 0;">Dawid</p><p style="margin:4px 0 0;font-size:13px;color:#A3A3A6;">Możesz po prostu odpowiedzieć na ten list.</p>`;
const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "";

export async function followupOn(base44) {
  const s = await getSetting(base44, "po_spotkaniu").catch(() => null);
  return s?.wlaczone !== false;
}
export async function setFollowup(base44, on) {
  await saveSetting(base44, "po_spotkaniu", { wlaczone: !!on });
}

const plDay = (iso) => new Date(iso).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Warsaw" });
const plHour = (iso) => new Date(iso).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" });

function nextBox(next, site) {
  if (!next) return "";
  return [
    `<div style="margin:28px 0;padding:22px 22px 4px;border:1px solid #2A2A2C;">`,
    LABEL("NASTĘPNE SPOTKANIE"),
    `<p style="margin:0 0 6px;font-size:21px;line-height:1.35;color:#F5EFE1;">${esc(next.title)}</p>`,
    `<p style="margin:0 0 4px;color:#C8C6C1;">${esc(plDay(next.start_datetime))}, ${esc(plHour(next.start_datetime))} (czasu polskiego)</p>`,
    emailButton("ZOBACZ I ZAPISZ SIĘ", `${site}/spotkania/${encodeURIComponent(next.slug)}`),
    `</div>`,
  ].join("");
}

// ctx: { name, title, site, next: {title, slug, start_datetime} | null }
export function followupMail(variant, ctx) {
  const hi = ctx.name ? `${esc(ctx.name)}, ` : "";
  const title = `«${esc(ctx.title)}»`;
  if (variant === "obecny") {
    return {
      subject: "Dziękuję za wczorajszy wieczór",
      html: [
        `<h1>Dziękuję za wczoraj</h1>`,
        P(`${hi}dziękuję za wspólny wieczór ${title}. Za czas, uwagę i pytania — także te, które zostały niezadane.`),
        P(`Po takim spotkaniu łatwo wrócić do codzienności i zostawić wszystko tak, jak było. Dlatego jedna prośba: zanim minie ten tydzień, zrób jeden mały krok. Nie wielki — jeden.`),
        LABEL("PIERWSZY KROK"),
        P(`Krótki test — kilka minut, żeby zobaczyć, ile jest w Tobie każdej z trzech śmierci i od którego etapu powrotu warto zacząć.`),
        emailButton("ZRÓB TEST", `${ctx.site}/test`),
        nextBox(ctx.next, ctx.site),
        P(`Jeśli chcesz, odpowiedz na ten list jednym zdaniem: co z wczorajszego wieczoru zostało z Tobą najbardziej?`),
        SIGN,
      ].join(""),
    };
  }
  return {
    subject: "Wczoraj Cię zabrakło — i to w porządku",
    html: [
      `<h1>Może następnym razem</h1>`,
      P(`${hi}wczoraj był wieczór ${title}. Nie udało Ci się dołączyć — i to w porządku. Życie rzadko pyta o nasze plany.`),
      P(`Spotkań nie nagrywam. To, co dzieje się na żywo, zostaje między tymi, którzy byli obecni — i właśnie dlatego może być prawdziwe.`),
      ctx.next
        ? nextBox(ctx.next, ctx.site)
        : [P(`Kolejne terminy pojawiają się na stronie spotkań.`), emailButton("ZOBACZ SPOTKANIA", `${ctx.site}/spotkania`)].join(""),
      P(`A jeśli chcesz zacząć już teraz — <a href="${esc(ctx.site)}/test">krótki test</a> pokaże, od czego zacząć.`),
      SIGN,
    ].join(""),
  };
}

function warsawHour(d = new Date()) {
  return Number(new Intl.DateTimeFormat("pl-PL", { hour: "numeric", hour12: false, timeZone: "Europe/Warsaw" }).format(d));
}

// Przejęcie wierszy do wysyłki (flaga przed wysyłką, SKIP LOCKED — dwa przebiegi nie wyślą dwa razy).
// Okno: od 9:00 dnia następnego po zakończeniu spotkania (czas polski) przez 36 h; wysyłka 8–20.
export async function claimFollowups(base44, limit = 150) {
  if (!(await followupOn(base44))) return [];
  const h = warsawHour();
  if (h < 8 || h >= 20) return [];
  const due = `(((date_trunc('day', (e.start_datetime + (COALESCE(e.duration_minutes,60) * interval '1 minute')) AT TIME ZONE 'Europe/Warsaw')
                 + interval '1 day 9 hours') AT TIME ZONE 'Europe/Warsaw'))`;
  return await runSql(base44, `
    WITH c AS (
      SELECT r.id FROM public.registrations r JOIN public.events e ON e.id = r.event_id
       WHERE r.status IN ('Zapisany','Obecny') AND e.status = 'Opublikowane' AND e.format = 'Online'
         AND e.start_datetime IS NOT NULL AND COALESCE(r.follow_up_sent, FALSE) = FALSE
         AND now() >= ${due} AND now() < ${due} + interval '36 hours'
       ORDER BY e.start_datetime LIMIT ${Number(limit) || 150}
       FOR UPDATE OF r SKIP LOCKED
    ), u AS (
      UPDATE public.registrations r SET follow_up_sent = TRUE FROM c WHERE r.id = c.id
      RETURNING r.id AS reg_id, r.first_name, r.email, r.status, r.joined_at, r.event_id
    )
    SELECT u.reg_id, u.first_name, u.email, u.status, u.joined_at, e.id AS event_id, e.title, e.start_datetime
      FROM u JOIN public.events e ON e.id = u.event_id`).catch(() => []);
}

export async function nextEventAfter(base44, eventId) {
  const rows = await runSql(base44, `SELECT title, slug, start_datetime FROM public.events
     WHERE status = 'Opublikowane' AND start_datetime > now() AND id::text <> ${escStr(String(eventId))}
     ORDER BY start_datetime ASC LIMIT 1`, true).catch(() => []);
  return rows?.[0] || null;
}

export const followupCtx = (row, site, next) => ({ name: firstName(row.first_name), title: row.title, site, next });
export const attended = (row) => !!row.joined_at || row.status === "Obecny";
