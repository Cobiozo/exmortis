import { listAuthUsers } from "./supabase.ts";
import { getSetting, APP_URL, loadAppUrl } from "./settings.ts";
import { sendMail } from "./smtp.ts";
import { emailButton } from "./emailLayout.ts";
import { hasPaidOrder, issueBuyerCode } from "./orderLinks.ts";

// Kod powitalny: każde nowe, potwierdzone konto dostaje jednorazowy kod 20 zł przy zamówieniu od 49 zł, ważny 7 dni
// od założenia konta (decyzja właściciela 19.11.2026; wcześniej −20% w cenie regularnej).
// Zasady (decyzja właściciela 14.11.2026): kod przypisany do e-maila konta, jednorazowy; tylko materiały cyfrowe
// ze Skarbca (ebooki, audio, wideo, kursy, pakiety) — bez POWRÓT, usług, kart i biletów;
// jeden kod w zamówieniu. Konta z Google są potwierdzone od razu.
// Wyłącznik: app_settings „powitalny” { wlaczony: false }.
// Od 16.11.2026: konto założone po zakupie (opłacone zamówienie na ten adres) dostaje zamiast −20% kod 20 zł
// (orderLinks.issueBuyerCode); oba kody mają znacznik „powitalny”, więc osoba dostaje tylko jeden.
export const WELCOME = { value: 20, min: 49, days: 7, typy: ["pdf", "audio", "wideo", "kurs", "pakiet"] };
export const WELCOME_FROM = "2026-11-14T00:00:00Z"; // konta założone wcześniej nie dostają kodu
export const WELCOME_TEXT = "Na początek drogi: 20 zł na pierwszy materiał ze Skarbca (zamówienie od 49 zł)";

const warsawDate = (ms: number) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(new Date(ms));
const plDate = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Warsaw" });

function newCode() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // bez 0/O i 1/I
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  return "WITAJ-" + [...b].map((x) => abc[x % abc.length]).join("");
}

export async function welcomeEnabled(base44) {
  const s = await getSetting(base44, "powitalny").catch(() => null);
  return s?.wlaczony !== false;
}

// Kod i mail dla jednego potwierdzonego konta. Zwraca true, gdy kod (20 zł od 49 zł; kupujący — kod 20 zł po zakupie) został wydany.
// Wywołania: zadanie cykliczne (niżej) oraz authMail „welcome” zaraz po kliknięciu linku potwierdzającego,
// żeby drugi mail (podziękowanie + kod) przyszedł od razu, a nie po kilku minutach.
export async function issueWelcomeFor(base44, u: { email?: string; created_at?: string; email_confirmed_at?: string; confirmed_at?: string }) {
  if (!(await welcomeEnabled(base44))) return false;
  const from = Math.max(Date.parse(WELCOME_FROM), Date.now() - WELCOME.days * 86400000);
  const created = Date.parse(String(u?.created_at || ""));
  if (!u?.email || !(u.email_confirmed_at || u.confirmed_at) || !Number.isFinite(created) || created < from) return false;
  const email = String(u.email).toLowerCase();
  const E = base44.asServiceRole.entities.DiscountCode;
  const has = await E.filter({ email, powitalny: true }, "-created_date", 1).catch(() => null);
  if (!has || has.length) return false; // błąd odczytu albo kod już jest — nic nie robimy
  if (await hasPaidOrder(base44, email)) return !!(await issueBuyerCode(base44, email).catch(() => null));
  const until = warsawDate(created + WELCOME.days * 86400000);
  const code = newCode();
  await E.create({
    code, kind: "kwota", value: WELCOME.value, min_zl: WELCOME.min, valid_until: until, max_uses: 1, uses: 0, active: true,
    email, powitalny: true, typy: WELCOME.typy, w_powiadomieniach: false,
    opis: WELCOME_TEXT,
  });
  await loadAppUrl(base44).catch(() => {}); // adres przycisku — bez tego APP_URL bywa pusty
  // Treść bez własnej ramki — wspólną oprawę (logo, stopka, kolory) nakłada emailLayout w smtpSend, jak w pozostałych mailach.
  const html = `<h1>Dziękuję za założenie konta</h1>
      <p>Twoje konto exmortis jest aktywne. Zakupy, Biblioteka i ROZDROŻA czekają w jednym miejscu.</p>
      <p>Na początek drogi masz ode mnie 20 zł rabatu na pierwszy materiał ze Skarbca:</p>
      <p style="font-family:monospace;font-size:22px;letter-spacing:3px;color:#C9A24A;border:1px dashed #C9A24A;padding:12px 16px;display:inline-block">${code}</p>
      <p style="color:#A3A3A6;font-size:14px;">Kod jest ważny do ${plDate(until)} włącznie, jednorazowy i działa tylko z adresem tego konta. Działa przy zamówieniu od ${WELCOME.min} zł na e-booki, audio, kursy i pakiety (bez programu POWRÓT, usług, kart podarunkowych i biletów). Wpisz go w kasie w polu „Kod rabatowy”.</p>
      ${emailButton("ZOBACZ SKARBIEC", `${APP_URL}/skarbiec`)}
      <p>Dawid</p>`;
  await sendMail(base44, { kind: "powitalny", ref: code, to: email, subject: "EXMORTIS · Dziękuję — 20 zł na początek drogi", html, preheader: "Twoje konto jest aktywne. Na pierwszy materiał masz ode mnie 20 zł rabatu." })
    .catch((e) => console.error("kod powitalny — mail:", e?.message));
  return true;
}

// Zadanie cykliczne (cmsScheduled, co 5 min): nowe potwierdzone konta z ostatnich 7 dni bez kodu → kod + e-mail.
// Zapas dla kont z Google i dla sytuacji, gdy przeglądarka nie zdążyła wywołać „welcome”.
export async function issueWelcomeCodes(base44, limit = 20) {
  if (!(await welcomeEnabled(base44))) return 0;
  const from = Math.max(Date.parse(WELCOME_FROM), Date.now() - WELCOME.days * 86400000);
  const users = (await listAuthUsers()).filter((u: any) => {
    const created = Date.parse(String(u.created_at || ""));
    return u.email && (u.email_confirmed_at || u.confirmed_at) && Number.isFinite(created) && created >= from;
  });
  let n = 0;
  for (const u of users.slice(0, 200)) {
    if (n >= limit) break;
    if (await issueWelcomeFor(base44, u as any).catch((e) => { console.error("kod powitalny:", e?.message); return false; })) n++;
  }
  return n;
}
