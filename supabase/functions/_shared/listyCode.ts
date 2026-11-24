import { getSetting, APP_URL, loadAppUrl } from "./settings.ts";
import { sendMail } from "./smtp.ts";
import { emailButton } from "./emailLayout.ts";

// Kod za zapis na Listy powrotu (decyzja właściciela 19.11.2026): każdy nowo potwierdzony adres dostaje
// jednorazowy kod 10 zł przy zamówieniu od 49 zł na materiały cyfrowe ze Skarbca (e-booki, audio, wideo, kursy, pakiety) — bez programu POWRÓT,
// Rozmowy na progu i innych usług, kart podarunkowych i biletów. Kod przypisany do adresu e-mail, ważny 30 dni.
// Jeden kod na adres na zawsze (znacznik „listy”) — ponowny zapis po wypisie nie daje drugiego kodu.
// Wyłącznik: app_settings „listy_kod” { wlaczony: false }.
export const LISTY_CODE = { value: 10, min: 49, days: 30, typy: ["pdf", "audio", "wideo", "kurs", "zestaw", "pakiet"] };
export const LISTY_CODE_TEXT = "Za zapis na Listy powrotu: 10 zł na materiał ze Skarbca (zamówienie od 49 zł)";

const warsawDate = (ms: number) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(new Date(ms));
const plDate = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Warsaw" });

function newCode() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // bez 0/O i 1/I
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  return "LISTY-" + [...b].map((x) => abc[x % abc.length]).join("");
}

export async function listyCodeEnabled(base44) {
  const s = await getSetting(base44, "listy_kod").catch(() => null);
  return s?.wlaczony !== false;
}

// Wywołanie: subscribeNewsletter „confirm” — tylko przy pierwszym potwierdzeniu adresu (nie przy ponownym kliknięciu).
// Zwraca kod albo null (wyłączone, kod już był, błąd odczytu).
export async function issueListyCode(base44, rawEmail: string) {
  const email = String(rawEmail || "").trim().toLowerCase();
  if (!email || !(await listyCodeEnabled(base44))) return null;
  const E = base44.asServiceRole.entities.DiscountCode;
  const has = await E.filter({ email, listy: true }, "-created_date", 1).catch(() => null);
  if (!has || has.length) return null;
  const until = warsawDate(Date.now() + LISTY_CODE.days * 86400000);
  const code = newCode();
  await E.create({
    code, kind: "kwota", value: LISTY_CODE.value, min_zl: LISTY_CODE.min, valid_until: until, max_uses: 1, uses: 0, active: true,
    email, listy: true, typy: LISTY_CODE.typy, w_powiadomieniach: false, opis: LISTY_CODE_TEXT,
  });
  await loadAppUrl(base44).catch(() => {}); // adres przycisku — bez tego APP_URL bywa pusty
  // Treść bez własnej ramki — wspólną oprawę nakłada emailLayout w smtpSend, jak w pozostałych mailach.
  const html = `<h1>Dziękuję za zapis na Listy powrotu</h1>
      <p>Zapis jest potwierdzony. Będę pisać o tym, co pomaga wracać: historie, myśli i pytania, które warto sobie zadać.</p>
      <p>Na powitanie masz ode mnie 10 zł rabatu na materiał ze Skarbca:</p>
      <p style="font-family:monospace;font-size:22px;letter-spacing:3px;color:#C9A24A;border:1px dashed #C9A24A;padding:12px 16px;display:inline-block">${code}</p>
      <p style="color:#A3A3A6;font-size:14px;">Kod jest jednorazowy, ważny do ${plDate(until)} włącznie i działa z tym adresem e-mail przy zamówieniu od ${LISTY_CODE.min} zł. Obejmuje e-booki, audio, kursy i pakiety — nie dotyczy programu POWRÓT, Rozmowy na progu ani innych usług, kart podarunkowych i biletów. Wpisz go w kasie w polu „Kod rabatowy”.</p>
      ${emailButton("ZOBACZ SKARBIEC", `${APP_URL}/skarbiec`)}
      <p>Dawid</p>`;
  await sendMail(base44, { kind: "listy_kod", ref: code, to: email, subject: "EXMORTIS · Dziękuję za zapis — 10 zł na początek", html, preheader: "Zapis potwierdzony. Na materiał ze Skarbca masz ode mnie 10 zł rabatu." })
    .catch((e) => console.error("kod Listów — mail:", e?.message));
  return code;
}