// JEDNA lista słów sygnałowych dla wszystkich formularzy (POWRÓT, kontakt, podcast).
// Rozpoznawanie po normalizacji: małe litery, bez polskich znaków (ł → l, ą → a …), pojedyncze spacje.
import { sendMail, adminTo } from "./smtp.ts";
import { APP_URL, loadAppUrl } from "./settings.ts";

export function normalize(text: unknown) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Każdy wpis to fragment po normalizacji — łapie odmiany bez zgadywania form.
export const CRISIS_SIGNALS = [
  "samoboj",
  "odebrac sobie zycie",
  "odbiora sobie zycie",
  "zabic sie",
  "zabije sie",
  "nie chce zyc",
  "nie chce juz zyc",
  "nie chce dluzej zyc",
  "skonczyc ze soba",
  "targnac sie",
  "samookalecz",
  "chce umrzec",
  "nie warto zyc",
];

// true, gdy którakolwiek z podanych treści zawiera sygnał kryzysowy.
export function isUrgent(...texts: unknown[]) {
  const t = normalize(texts.filter(Boolean).join(" \n "));
  return CRISIS_SIGNALS.some((s) => t.includes(s));
}

// OSOBNY mail do administratora: bez treści i bez danych osoby — tylko link do panelu.
export async function notifyUrgent(base44: any) {
  await loadAppUrl(base44).catch(() => {});
  const admin = await adminTo(base44).catch(() => null);
  if (!admin) return;
  const link = `${APP_URL}/admin/kontakty`;
  const html = `<div style="background:#0A0A0B;color:#E2E2E2;font-family:Georgia,serif;padding:32px;max-width:520px">
    <p style="letter-spacing:4px;color:#C9A24A;font-size:13px">EXMORTIS</p>
    <h1 style="font-size:22px">Pilna wiadomość w panelu</h1>
    <p style="color:#8A8A8C;line-height:1.7">Do panelu trafiła wiadomość oznaczona jako pilna. Otwórz panel, żeby ją zobaczyć.</p>
    <p><a href="${link}" style="color:#C9A24A">Otwórz panel</a></p>
  </div>`;
  await sendMail(base44, { to: admin, subject: "Pilna wiadomość w panelu", html, kind: "inne" }).catch(() => {});
}