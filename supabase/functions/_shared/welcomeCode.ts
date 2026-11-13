import { listAuthUsers } from "./supabase.ts";
import { getSetting, APP_URL } from "./settings.ts";
import { sendMail } from "./smtp.ts";
import { emailButton } from "./emailLayout.ts";

// Kod powitalny: każde nowe, potwierdzone konto dostaje jednorazowy kod −20%, ważny 7 dni od założenia konta.
// Zasady (decyzja właściciela 14.11.2026): kod przypisany do e-maila konta, jednorazowy; tylko materiały cyfrowe
// ze Skarbca (ebooki, audio, wideo, kursy, pakiety) w cenie regularnej — bez POWRÓT, kart, biletów i przedsprzedaży;
// jeden kod w zamówieniu. Konta z Google są potwierdzone od razu.
// Wyłącznik: app_settings „powitalny” { wlaczony: false }.
export const WELCOME = { value: 20, days: 7, typy: ["pdf", "audio", "wideo", "kurs", "pakiet"] };
export const WELCOME_FROM = "2026-11-14T00:00:00Z"; // konta założone wcześniej nie dostają kodu
export const WELCOME_TEXT = "Na początek drogi: 20% na pierwszy materiał ze Skarbca";

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

// Zadanie cykliczne (cmsScheduled, co 5 min): nowe potwierdzone konta z ostatnich 7 dni bez kodu → kod + e-mail.
export async function issueWelcomeCodes(base44, limit = 20) {
  if (!(await welcomeEnabled(base44))) return 0;
  const from = Math.max(Date.parse(WELCOME_FROM), Date.now() - WELCOME.days * 86400000);
  const users = (await listAuthUsers()).filter((u: any) => {
    const created = Date.parse(String(u.created_at || ""));
    return u.email && (u.email_confirmed_at || u.confirmed_at) && Number.isFinite(created) && created >= from;
  });
  if (!users.length) return 0;
  const E = base44.asServiceRole.entities.DiscountCode;
  let n = 0;
  for (const u of users.slice(0, 200)) {
    if (n >= limit) break;
    const email = String(u.email).toLowerCase();
    const has = await E.filter({ email, powitalny: true }, "-created_date", 1).catch(() => null);
    if (!has || has.length) continue; // błąd odczytu albo kod już jest — nic nie robimy
    const until = warsawDate(Date.parse(String(u.created_at)) + WELCOME.days * 86400000);
    const code = newCode();
    await E.create({
      code, kind: "procent", value: WELCOME.value, valid_until: until, max_uses: 1, uses: 0, active: true,
      email, powitalny: true, typy: WELCOME.typy, bez_promocji: true, w_powiadomieniach: false,
      opis: WELCOME_TEXT,
    });
    n++;
    const html = `<div style="background:#0A0A0B;color:#E2E2E2;font-family:Georgia,serif;padding:32px;max-width:560px">
      <p style="letter-spacing:4px;color:#C9A24A;font-size:13px">EXMORTIS</p>
      <h1 style="font-size:22px;font-weight:normal">Na początek drogi</h1>
      <p style="line-height:1.7">Dziękuję, że założyłeś(-aś) konto — <span style="color:#8A8A8C">a właściwie: dziękuję, że jesteś.</span> Na pierwszy materiał ze Skarbca masz ode mnie 20% rabatu.</p>
      <p style="font-family:monospace;font-size:22px;letter-spacing:3px;color:#C9A24A;border:1px dashed #C9A24A;padding:12px 16px;display:inline-block">${code}</p>
      <p style="line-height:1.7;color:#8A8A8C;font-size:13px">Kod jest ważny do ${plDate(until)} włącznie, jednorazowy i działa tylko z adresem tego konta. Obejmuje ebooki, audio i kursy w cenie regularnej (bez programu POWRÓT, kart podarunkowych, biletów i przedsprzedaży). Wpisz go w kasie w polu „Kod rabatowy”.</p>
      <p style="margin:24px 0">${emailButton("ZOBACZ SKARBIEC", `${APP_URL}/skarbiec`)}</p>
      <p>Dawid, exmortis</p>
    </div>`;
    await sendMail(base44, { kind: "powitalny", ref: code, to: email, subject: "EXMORTIS · 20% na początek drogi", html }).catch((e) => console.error("kod powitalny — mail:", e?.message));
  }
  return n;
}
