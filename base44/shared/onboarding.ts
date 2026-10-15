// „Listy prowadzące” po zakupie e-booka, audiobooka lub kursu: dzień 1, 3, 7 i 14 od opłacenia.
// Cel: wrażenie prowadzenia przez mentora, a nie sklepu — jak korzystać, jedno pytanie, co się zmieniło
// (prośba o opinię), następny krok. Wysyła zadanie cykliczne (co 15 min), tylko w godzinach 8–20 czasu
// polskiego, najwyżej jeden taki list na osobę na 36 godzin. Każdy krok ma okno 48 h — po wdrożeniu nie
// „dogania” starych zamówień lawiną maili. Pomija: prezenty (czyta ktoś inny), zamówienia ze zwrotem,
// osoby, które wyłączyły serię linkiem z maila. Przełącznik: app_settings „prowadzenie” {wlaczone}.
import { runSql, escStr } from "./supabase.ts";
import { getSetting, saveSetting, loadAppUrl } from "./settings.ts";
import { sendMail } from "./smtp.ts";
import { nextStep } from "./nextStep.ts";
import { emailButton } from "./emailLayout.ts";

export const STEPS = [1, 3, 7, 14];
const DAY = 864e5;
const TYPES = ["pdf", "audio", "wideo", "kurs", "pakiet"];

const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "";

export async function onboardingOn(base44) {
  const s = await getSetting(base44, "prowadzenie").catch(() => null);
  return s?.wlaczone !== false;
}
export async function setOnboarding(base44, on) {
  await saveSetting(base44, "prowadzenie", { wlaczone: !!on });
}

async function ensure(base44) {
  await runSql(base44, `CREATE TABLE IF NOT EXISTS public.onboarding_mails (
      order_id text NOT NULL, step smallint NOT NULL, email text NOT NULL, sent_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (order_id, step));
    CREATE INDEX IF NOT EXISTS onboarding_mails_email ON public.onboarding_mails (lower(email), sent_at DESC);
    CREATE TABLE IF NOT EXISTS public.onboarding_optout (email text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS public.onboarding_tokens (token text PRIMARY KEY, email text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());`);
}

// Słownik zależny od rodzaju materiału.
function vocab(type) {
  if (type === "audio") return { verb: "słuchać", noun: "słuchanie", unit: "jeden fragment dziennie", back: "WRÓĆ DO NAGRANIA", open: "OTWÓRZ NAGRANIE" };
  if (type === "kurs" || type === "wideo") return { verb: "przechodzić", noun: "lekcje", unit: "jedna lekcja dziennie", back: "WRÓĆ DO KURSU", open: "OTWÓRZ KURS" };
  if (type === "pakiet") return { verb: "korzystać", noun: "materiały", unit: "jeden materiał naraz, jeden fragment dziennie", back: "WRÓĆ DO MATERIAŁÓW", open: "OTWÓRZ MATERIAŁY" };
  return { verb: "czytać", noun: "lektura", unit: "jeden rozdział dziennie", back: "WRÓĆ DO LEKTURY", open: "OTWÓRZ E-BOOKA" };
}

const P = (t) => `<p style="margin:0 0 18px;">${t}</p>`;
const QUOTE = (t) => `<p style="margin:26px 0;padding:6px 0 6px 20px;border-left:2px solid #C9A24A;font-size:20px;line-height:1.55;color:#F5EFE1;font-style:italic;">${t}</p>`;
const LABEL = (t) => `<p style="margin:0 0 10px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:3px;color:#C9A24A;">${t}</p>`;
const SIGN = `<p style="margin:30px 0 0;">Dawid</p><p style="margin:4px 0 0;font-size:13px;color:#A3A3A6;">Możesz po prostu odpowiedzieć na ten list.</p>`;
const optout = (url) => `<p style="margin:28px 0 0;padding-top:16px;border-top:1px solid #2A2A2C;font-size:12px;line-height:1.6;color:#7A7A7D;">To jeden z czterech krótkich listów, które wysyłam po zakupie. <a href="${esc(url)}" style="color:#A3A3A6;">Nie chcę tych listów</a> — wyłączysz je jednym kliknięciem (zamówienia i dostęp do materiałów działają dalej).</p>`;

// Treść jednego listu. ctx: { name, product, type, site, next, optoutUrl }
export function onboardingMail(step, ctx) {
  const v = vocab(ctx.type);
  const hi = ctx.name ? `${esc(ctx.name)}, ` : "";
  const prod = `„${esc(ctx.product)}”`;
  const materials = `${ctx.site}/konto`;
  let subject = "", body = "";

  if (step === 1) {
    subject = ctx.type === "kurs" || ctx.type === "wideo" ? `Zanim zaczniesz: jak przechodzić ${prod}`
      : ctx.type === "audio" ? `Zanim zaczniesz: jak słuchać ${prod}` : `Zanim zaczniesz: jak czytać ${prod}`;
    body = [
      `<h1>Zanim zaczniesz</h1>`,
      P(`${hi}od wczoraj ${prod} jest w Twoich materiałach. Zanim pójdziesz dalej, kilka słów o tym, jak z tego korzystać — tak, żeby to nie była kolejna rzecz ${v.verb === "czytać" ? "przeczytana" : v.verb === "słuchać" ? "przesłuchana" : "zaliczona"} i odłożona na półkę.`),
      LABEL("CZTERY ZASADY"),
      P(`<b style="color:#F5EFE1;">Powoli.</b> Wystarczy ${v.unit}. Powrót nie lubi pośpiechu — to, co ważne, potrzebuje czasu, żeby w Tobie osiąść.`),
      P(`<b style="color:#F5EFE1;">Z kartką obok.</b> Zapisuj zdania, które Cię zatrzymają. Nie te najmądrzejsze — te, które bolą albo coś budzą.`),
      P(`<b style="color:#F5EFE1;">Bez oceniania siebie.</b> Jeśli coś w Tobie się opiera, to też jest informacja. Zapisz ją i idź dalej.`),
      P(`<b style="color:#F5EFE1;">Wracaj.</b> Do tych samych miejsc po tygodniu. Spotkasz je jako ktoś odrobinę inny.`),
      emailButton(v.open, materials),
      P(`Za dwa dni napiszę z jednym pytaniem. Nie musisz odpowiadać mnie — wystarczy, że odpowiesz sobie.`),
      SIGN,
    ].join("");
  } else if (step === 3) {
    subject = "Jedno pytanie na dziś";
    body = [
      `<h1>Jedno pytanie</h1>`,
      P(`${hi}minęło kilka dni z ${prod}. Nie pytam, ile jest już za Tobą. Pytam o jedno:`),
      QUOTE("Które zdanie zostało ze mną najdłużej — i co mówi o miejscu, w którym dziś stoję?"),
      P(`Zapisz odpowiedź. Jedno, dwa zdania wystarczą. Jeśli jeszcze nic nie zostało — to też jest odpowiedź. Wtedy wróć do ostatniego fragmentu i przejdź go jeszcze raz, wolniej.`),
      P(`Jeśli chcesz, odpowiedz na ten list. Czasem samo napisanie komuś robi różnicę.`),
      emailButton(v.back, materials),
      SIGN,
    ].join("");
  } else if (step === 7) {
    subject = "Co się zmieniło?";
    body = [
      `<h1>Tydzień później</h1>`,
      P(`${hi}tydzień temu ${prod} trafiło do Twoich rąk. Chcę zapytać wprost: co się zmieniło?`),
      P(`Może niewiele — i to jest w porządku. Powrót rzadko wygląda jak przełom. Częściej jak jedno spokojniejsze rano. Jedna rozmowa, na którą wcześniej zabrakłoby odwagi. Jedno zdanie, które wraca w ciszy.`),
      P(`Jeśli coś się poruszyło, podziel się tym w krótkiej opinii. Dwa, trzy zdania wystarczą. Pomagają osobom, które stoją dziś na początku tej drogi, zdecydować, czy to dla nich.`),
      emailButton("NAPISZ OPINIĘ", `${ctx.site}/konto?tab=zakupy`),
      P(`<span style="font-size:14px;color:#A3A3A6;">Publikuję także opinie krytyczne i za żadne nie płacę. Jeśli coś nie zadziałało — tym bardziej chcę o tym wiedzieć. Odpowiedz na ten list.</span>`),
      SIGN,
    ].join("");
  } else {
    subject = "Co dalej?";
    const nx = ctx.next;
    body = [
      `<h1>Następny krok</h1>`,
      P(`${hi}dwa tygodnie z ${prod}. To dobry moment, żeby się zatrzymać i zobaczyć, gdzie jesteś.`),
      P(`Powrót ma cztery etapy: Śmierć · Próg · Powrót · Inny. Żaden materiał nie przeprowadzi przez wszystkie naraz — i nie musi. Ważne jest, żeby zrobić kolejny krok, a nie wszystkie od razu.`),
      nx ? [
        `<div style="margin:28px 0 28px;padding:22px 22px 4px;border:1px solid #2A2A2C;">`,
        LABEL("NASTĘPNY KROK"),
        `<p style="margin:0 0 10px;font-size:21px;line-height:1.35;color:#F5EFE1;">${esc(nx.name)}</p>`,
        nx.text ? P(`<span style="color:#C8C6C1;">${esc(nx.text)}</span>`) : "",
        emailButton("ZOBACZ", `${ctx.site}/skarbiec/${encodeURIComponent(nx.slug)}`),
        `</div>`,
      ].join("") : [
        P(`Jeśli nie wiesz, gdzie dziś jesteś, zrób krótki test. Pokaże, ile jest w Tobie każdej z trzech śmierci — i od czego warto zacząć teraz.`),
        emailButton("ZRÓB TEST", `${ctx.site}/test`),
      ].join(""),
      P(`A jeśli wolisz po prostu porozmawiać z innymi, którzy idą tą drogą — <a href="${esc(ctx.site)}/spotkania">spotkania otwarte</a> są bezpłatne.`),
      P(`To ostatni list z tej krótkiej serii. Dziękuję, że dajesz sobie ten czas.`),
      SIGN,
    ].join("");
  }
  return { subject, html: body + (ctx.optoutUrl ? optout(ctx.optoutUrl) : "") };
}

function warsawHour(d = new Date()) {
  return Number(new Intl.DateTimeFormat("pl-PL", { hour: "numeric", hour12: false, timeZone: "Europe/Warsaw" }).format(d));
}

async function tokenFor(base44, email) {
  const ex = await runSql(base44, `SELECT token FROM public.onboarding_tokens WHERE email = ${escStr(email)} LIMIT 1`, true).catch(() => []);
  if (ex?.[0]?.token) return ex[0].token;
  const t = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  await runSql(base44, `INSERT INTO public.onboarding_tokens (token, email) VALUES (${escStr(t)}, ${escStr(email)}) ON CONFLICT DO NOTHING`);
  return t;
}

export async function onboardingStop(base44, token) {
  await ensure(base44);
  const t = String(token || "");
  if (!/^[a-f0-9]{30,80}$/.test(t)) return false;
  const r = await runSql(base44, `INSERT INTO public.onboarding_optout (email)
      SELECT email FROM public.onboarding_tokens WHERE token = ${escStr(t)}
    ON CONFLICT DO NOTHING RETURNING email`);
  if (r?.length) return true;
  const known = await runSql(base44, `SELECT 1 FROM public.onboarding_tokens WHERE token = ${escStr(t)}`, true).catch(() => []);
  return !!known?.length;
}

// Wywoływane przez zadanie cykliczne. Zwraca liczbę wysłanych.
export async function onboardingTick(base44, { limit = 25 } = {}) {
  if (!(await onboardingOn(base44))) return { off: true };
  const h = warsawHour();
  if (h < 8 || h >= 20) return { cisza: true };
  await ensure(base44);
  const orders = await runSql(base44, `
    SELECT o.id::text AS id, lower(o.buyer_email) AS email, o.buyer_name, o.items,
           COALESCE(o.updated_date, o.created_date)::timestamptz AS paid
      FROM public.orders o
     WHERE o.status = 'COMPLETED' AND COALESCE(o.total, 0) > 0
       AND COALESCE(o.updated_date, o.created_date)::timestamptz > now() - interval '17 days'
       AND COALESCE(o.buyer_email, '') <> ''
       AND NOT EXISTS (SELECT 1 FROM public.onboarding_optout x WHERE x.email = lower(o.buyer_email))
       AND NOT EXISTS (SELECT 1 FROM public.order_refunds r WHERE r.order_id::text = o.id::text)
     ORDER BY paid ASC LIMIT 300`, true).catch(async () => runSql(base44, `
    SELECT o.id::text AS id, lower(o.buyer_email) AS email, o.buyer_name, o.items,
           COALESCE(o.updated_date, o.created_date)::timestamptz AS paid
      FROM public.orders o
     WHERE o.status = 'COMPLETED' AND COALESCE(o.total, 0) > 0
       AND COALESCE(o.updated_date, o.created_date)::timestamptz > now() - interval '17 days'
       AND COALESCE(o.buyer_email, '') <> ''
       AND NOT EXISTS (SELECT 1 FROM public.onboarding_optout x WHERE x.email = lower(o.buyer_email))
     ORDER BY paid ASC LIMIT 300`, true).catch(() => []));
  if (!orders?.length) return { sent: 0 };

  const now = Date.now();
  // Kandydaci: krok, którego termin minął najwyżej 48 h temu.
  const due = [];
  for (const o of orders) {
    const paid = new Date(o.paid).getTime();
    for (const s of STEPS) {
      const at = paid + s * DAY;
      if (now >= at && now < at + 2 * DAY) due.push({ o, step: s });
    }
  }
  if (!due.length) return { sent: 0 };

  const ids = [...new Set(due.map((d) => d.o.id))];
  const sent = await runSql(base44, `SELECT order_id, step FROM public.onboarding_mails WHERE order_id IN (${ids.map(escStr).join(",")})`, true).catch(() => []);
  const done = new Set((sent || []).map((r) => `${r.order_id}:${r.step}`));
  const recent = await runSql(base44, `SELECT DISTINCT lower(email) AS email FROM public.onboarding_mails WHERE sent_at > now() - interval '36 hours'`, true).catch(() => []);
  const busy = new Set((recent || []).map((r) => r.email));

  // Produkty z zamówień (typ i nazwa) — tylko materiały do pracy własnej, bez prezentów.
  const pids = [...new Set(due.flatMap((d) => (Array.isArray(d.o.items) ? d.o.items : []).filter((i) => !i?.gift).map((i) => String(i.product_id || ""))).filter(Boolean))];
  if (!pids.length) return { sent: 0 };
  const prows = await runSql(base44, `SELECT id::text AS id, name, product_type, price::float8 AS price FROM public.products WHERE id::text IN (${pids.map(escStr).join(",")})`, true).catch(() => []);
  const P_ = Object.fromEntries((prows || []).map((p) => [p.id, p]));

  const site = String(await loadAppUrl(base44)).replace(/\/+$/, "");
  const siteUrl = /base44\.app/.test(site) ? "https://exmortis.pl" : site;
  let n = 0;
  for (const { o, step } of due) {
    if (n >= limit) break;
    if (done.has(`${o.id}:${step}`) || busy.has(o.email)) continue;
    const items = (Array.isArray(o.items) ? o.items : []).filter((i) => !i?.gift && P_[String(i.product_id)] && TYPES.includes(P_[String(i.product_id)].product_type));
    if (!items.length) continue;
    const main = items.map((i) => P_[String(i.product_id)]).sort((a, b) => (b.price || 0) - (a.price || 0))[0];
    // Zapis przed wysyłką (blokada podwójnej wysyłki przy równoległych przebiegach).
    const claim = await runSql(base44, `INSERT INTO public.onboarding_mails (order_id, step, email) VALUES (${escStr(o.id)}, ${step}, ${escStr(o.email)})
      ON CONFLICT DO NOTHING RETURNING order_id`).catch(() => []);
    if (!claim?.length) continue;
    try {
      const next = step === 14 ? await nextStep(base44, items.map((i) => String(i.product_id))).catch(() => null) : null;
      const token = await tokenFor(base44, o.email);
      const m = onboardingMail(step, {
        name: firstName(o.buyer_name), product: main.name, type: main.product_type, site: siteUrl, next,
        optoutUrl: `${siteUrl}/listy/wypis?d=${token}`,
      });
      await sendMail(base44, { kind: `prowadzenie_${step}`, ref: o.id, to: o.email, subject: m.subject, html: m.html,
        waznyDo: new Date(new Date(o.paid).getTime() + (step + 3) * DAY) });
      busy.add(o.email);
      n++;
    } catch (e) {
      // Nieudana wysyłka: zwalniamy krok, żeby spróbować w kolejnym przebiegu (w oknie 48 h).
      await runSql(base44, `DELETE FROM public.onboarding_mails WHERE order_id = ${escStr(o.id)} AND step = ${step}`).catch(() => {});
      console.error("prowadzenie:", e?.message);
    }
  }
  return { sent: n };
}
