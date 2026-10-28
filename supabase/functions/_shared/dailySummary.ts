import { runSql } from "./supabase.ts";
import { sendMail, adminTo } from "./smtp.ts";
import { APP_URL, loadAppUrl } from "./settings.ts";
import { plWhen } from "./events.ts";

// ============ Podsumowanie dnia ============
// Jeden e-mail na dobę (22:00 czasu polskiego) zamiast powiadomień przy każdym zapisie i zamówieniu.
// Tylko odczyt — nic nie zmienia w danych. Wołane z cronTick w tle: błąd tutaj nie zatrzymuje
// pozostałych zadań, a blokada w app_settings pilnuje jednego maila na dobę.

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const WINDOW = `now() - interval '24 hours'`;
const zl = (n) => `${Number(n || 0).toFixed(2).replace(".", ",")} zł`;
const num = (n) => Number(n) || 0;

// Nazwy produktów z zamówienia (items to tablica jsonb: nazwa, ilość, cena).
const itemsNames = (items) => {
  let arr = items;
  if (typeof arr === "string") {
    try {
      arr = JSON.parse(arr);
    } catch {
      arr = [];
    }
  }
  return (Array.isArray(arr) ? arr : []).map((i) => String((i && i.name) || "")).filter(Boolean).join(", ");
};

const p = (t) => `<p style="margin:0 0 7px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#E2E2E2;">${t}</p>`;
const small = (t) => `<p style="margin:0 0 5px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.55;color:#8A8A8C;">${t}</p>`;
const section = (title, body) =>
  `<tr><td style="padding:0 0 26px 0;">
     <p style="margin:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:3px;color:#C9A24A;">${title}</p>
     ${body}
   </td></tr>`;
const adminLink = (url, label) =>
  `<p style="margin:8px 0 0 0;"><a href="${esc(url)}" style="color:#C9A24A;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:1px;">${esc(label)} →</a></p>`;

export async function dailySummary(base44) {
  const sinceIso = new Date(Date.now() - 24 * 3600e3).toISOString();
  const q = (sql) => runSql(base44, sql, true).catch(() => []);
  const count = (entity, query) =>
    base44.asServiceRole.entities[entity].count(query).catch(() => 0);

  const [perEvent, upcoming, people, unsub, freeOrders, paidOrders, listy, contact, contactNames, powrot, podcast, mailSent, mailBad] =
    await Promise.all([
      q(`SELECT e.title, e.start_datetime, count(*)::int AS n
           FROM public.registrations r JOIN public.events e ON e.id = r.event_id
          WHERE r.created_at > ${WINDOW}
          GROUP BY e.title, e.start_datetime ORDER BY e.start_datetime`),
      q(`SELECT count(*)::int AS n
           FROM public.registrations r JOIN public.events e ON e.id = r.event_id
          WHERE r.status IN ('Zapisany','Obecny') AND e.start_datetime > now()`),
      q(`SELECT first_name, email, status, question_for_dawid FROM public.registrations
          WHERE created_at > ${WINDOW} ORDER BY created_at DESC LIMIT 200`),
      q(`SELECT count(*)::int AS n FROM public.subscribers
          WHERE status = 'unsubscribed' AND updated_date > ${WINDOW}`),
      q(`SELECT buyer_name, buyer_email, items FROM public.orders
          WHERE status = 'FREE' AND created_date > ${WINDOW} ORDER BY created_date DESC LIMIT 100`),
      q(`SELECT buyer_name, buyer_email, items, total FROM public.orders
          WHERE status = 'COMPLETED' AND created_date > ${WINDOW} ORDER BY created_date DESC LIMIT 100`),
      q(`SELECT count(*)::int AS n FROM public.subscribers
          WHERE status = 'active' AND confirmed_at > ${WINDOW}`),
      q(`SELECT count(*)::int AS n FROM public.contact_messages WHERE created_date > ${WINDOW}`),
      q(`SELECT name FROM public.contact_messages WHERE created_date > ${WINDOW} ORDER BY created_date DESC LIMIT 50`),
      q(`SELECT full_name FROM public.powrot_applications WHERE created_date > ${WINDOW} ORDER BY created_date DESC LIMIT 50`),
      q(`SELECT full_name FROM public.podcast_applications WHERE created_date > ${WINDOW} ORDER BY created_date DESC LIMIT 50`),
      count("MailQueue", { status: "wyslany", created_date: { $gte: sinceIso } }),
      count("MailQueue", { status: "blad", created_date: { $gte: sinceIso } }),
    ]);

  const now = new Date();
  const dayPl = new Intl.DateTimeFormat("pl-PL", {
    timeZone: "Europe/Warsaw", weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(now);
  const dayRef = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  const appUrl = (await loadAppUrl(base44).catch(() => null)) || APP_URL;

  const newRegs = (perEvent || []).reduce((s, r) => s + num(r.n), 0);
  const upcomingN = num(upcoming?.[0]?.n);
  const peopleRows = Array.isArray(people) ? people : [];
  const freeRows = Array.isArray(freeOrders) ? freeOrders : [];
  const paidRows = Array.isArray(paidOrders) ? paidOrders : [];
  const paidSum = paidRows.reduce((s, o) => s + num(o.total), 0);
  const questions = peopleRows.filter((r) => String(r.question_for_dawid || "").trim());
  const unsubN = num(unsub?.[0]?.n);
  const listyN = num(listy?.[0]?.n);
  const contactN = num(contact?.[0]?.n);
  const powrotRows = Array.isArray(powrot) ? powrot : [];
  const podcastRows = Array.isArray(podcast) ? podcast : [];
  const badN = num(mailBad);

  const parts = [];

  // Błędy poczty na górze — najważniejsza informacja dnia.
  if (badN > 0) {
    parts.push(`<tr><td style="padding:0 0 24px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1A0A0A;border-left:3px solid #BC1E22;">
        <tr><td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#E2E2E2;">
          <strong style="color:#BC1E22;">Poczta: ${badN} ${badN === 1 ? "wiadomość" : "wiadomości"} z błędem w ciągu doby.</strong><br>
          Sprawdź kolejkę w panelu: ${esc(`${appUrl}/admin/ustawienia`)}
        </td></tr></table>
    </td></tr>`);
  }

  if (newRegs > 0) {
    const body = [
      p(`Nowych zapisów: <strong>${newRegs}</strong> · zapisanych na nadchodzące spotkania: <strong>${upcomingN}</strong>`),
      ...(perEvent || []).map((r) =>
        small(`• ${esc(r.title)} — ${esc(plWhen(r.start_datetime))} · ${num(r.n)}`)
      ),
      ...peopleRows.map((r) => p(`${esc(r.first_name)} · ${esc(r.email)} · ${esc(r.status)}`)),
      adminLink(`${appUrl}/admin/spotkania`, "Spotkania"),
    ].join("");
    parts.push(section("ZAPISY NA SPOTKANIA", body));
  }

  if (questions.length) {
    const body = [
      ...questions.map((r) => p(`<strong>${esc(r.first_name)}</strong>: ${esc(String(r.question_for_dawid).trim())}`)),
      adminLink(`${appUrl}/admin/spotkania`, "Spotkania"),
    ].join("");
    parts.push(section("PYTANIA PRZY ZAPISIE", body));
  }

  if (unsubN > 0) {
    parts.push(section("WYPISANIA Z LIST", p(`Wypisało się: <strong>${unsubN}</strong>`) + adminLink(`${appUrl}/admin/newsletter`, "Newsletter")));
  }

  if (freeRows.length) {
    const body = [
      ...freeRows.map((o) => p(`${esc(itemsNames(o.items) || "materiał")} — ${esc(o.buyer_name)} (${esc(o.buyer_email)})`)),
      adminLink(`${appUrl}/admin/zamowienia`, "Zamówienia"),
    ].join("");
    parts.push(section("ZAMÓWIENIA BEZPŁATNE", body));
  }

  if (paidRows.length) {
    const body = [
      p(`Opłacone: <strong>${paidRows.length}</strong> · suma dnia: <strong>${zl(paidSum)}</strong>`),
      ...paidRows.map((o) => p(`${esc(itemsNames(o.items) || "zamówienie")} — ${zl(o.total)} · ${esc(o.buyer_name)} (${esc(o.buyer_email)})`)),
      adminLink(`${appUrl}/admin/zamowienia`, "Zamówienia"),
    ].join("");
    parts.push(section("ZAMÓWIENIA PŁATNE", body));
  }

  if (listyN > 0) {
    parts.push(section("LISTY POWROTU", p(`Nowych potwierdzonych zapisów: <strong>${listyN}</strong>`) + adminLink(`${appUrl}/admin/newsletter`, "Newsletter")));
  }

  if (contactN > 0 || powrotRows.length || podcastRows.length) {
    const body = [];
    if (contactN > 0) body.push(p(`Formularz kontaktowy: <strong>${contactN}</strong>`));
    (Array.isArray(contactNames) ? contactNames : []).forEach((r) => {
      if (String(r.name || "").trim()) body.push(small(`• ${esc(r.name)}`));
    });
    if (powrotRows.length) body.push(p(`Zgłoszenia POWRÓT: <strong>${powrotRows.length}</strong> — ${powrotRows.map((r) => esc(r.full_name)).join(", ")}`));
    if (podcastRows.length) body.push(p(`Zgłoszenia podcastu: <strong>${podcastRows.length}</strong> — ${podcastRows.map((r) => esc(r.full_name)).join(", ")}`));
    body.push(adminLink(`${appUrl}/admin/kontakty`, "Baza kontaktów"));
    parts.push(section("FORMULARZE I ZGŁOSZENIA", body.join("")));
  }

  // Dzień bez zdarzeń — krótki mail, który potwierdza, że wysyłka działa.
  if (!parts.length) {
    parts.push(section("DZIŚ", p("Dziś bez nowych zapisów i zamówień.")));
  }

  parts.push(section("POCZTA", small(`Wysłane w ciągu doby: ${num(mailSent)} · z błędem: ${badN}`)));

  const html = `<div style="background:#0A0A0B;padding:32px 24px;font-family:Georgia,serif;color:#E2E2E2;">
    <div style="max-width:600px;margin:0 auto;">
      <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:4px;color:#C9A24A;">EXMORTIS</p>
      <p style="margin:0 0 4px 0;font-family:Cinzel,Georgia,serif;font-size:22px;line-height:1.25;color:#F5EFE1;">Podsumowanie dnia</p>
      <p style="margin:0 0 26px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#8A8A8C;">${esc(dayPl)} · ostatnie 24 godziny</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${parts.join("")}</table>
      <p style="margin:10px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2px;color:#5C5C5E;">PODSUMOWANIE WYSYŁANE CODZIENNIE OK. 22:00</p>
    </div>
  </div>`;

  const to = await adminTo(base44).catch(() => null);
  if (!to) return { ok: false, blad: "brak adresu administratora" };

  await sendMail(base44, {
    kind: "podsumowanie",
    ref: dayRef,
    to,
    subject: `exmortis — podsumowanie dnia ${dayPl}`,
    html,
  });

  return { ok: true, zapisy: newRegs, bezplatne: freeRows.length, platne: paidRows.length, suma: paidSum, bledy_poczty: badN };
}