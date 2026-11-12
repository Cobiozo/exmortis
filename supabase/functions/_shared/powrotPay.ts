import { runSql, escStr } from "./supabase.ts";

// Płatność za program POWRÓT — osobisty link wysyłany z panelu po rozmowie kwalifikacyjnej.
// Kolumny w powrot_applications dokłada wyłącznie panel (adminPowrot) przy pierwszej wysyłce linku;
// kasa (payuCreateOrder) tylko je czyta i aktualizuje — obsługa płatności nie wykonuje DDL.
const COLUMNS: [string, string][] = [
  ["pay_token", "text"],
  ["pay_amount", "numeric(10,2)"],
  ["pay_sent_at", "timestamptz"],
  ["pay_expires_at", "timestamptz"],
  ["pay_order_id", "text"],
  ["paid_at", "timestamptz"],
];

let READY = false;
export async function ensurePayColumns(base44) {
  if (READY) return;
  const adds = COLUMNS.map(([c, t]) => `ADD COLUMN IF NOT EXISTS ${c} ${t}`).join(", ");
  await runSql(base44, `ALTER TABLE public.powrot_applications ${adds}`);
  await runSql(base44, `CREATE INDEX IF NOT EXISTS powrot_pay_token_idx ON public.powrot_applications (pay_token)`).catch(() => {});
  READY = true;
}

export const PAY_DAYS = 7;
export const PAY_MIN = 100;
export const PAY_MAX = 20000;
export const PROGRAM_NAME = "Program POWRÓT — 8 sesji mentoringowych 1:1";

export const payLink = (appUrl: string, token: string) => `${appUrl}/powrot/platnosc?t=${token}`;

// Zgody na stronie płatności — dokładnie te teksty trafiają do rejestru zgód.
export const CONTRACT_CONSENT = (v: string) =>
  `Akceptuję Umowę o udział w programie POWRÓT (wersja ${v}) oraz Regulamin.`;
export const EARLY_CONSENT =
  "Żądam rozpoczęcia programu przed upływem 14 dni od zawarcia umowy. Przyjmuję do wiadomości, że jeśli odstąpię od umowy, zapłacę za część programu zrealizowaną do chwili odstąpienia, a po pełnym wykonaniu programu utracę prawo odstąpienia.";

// Zgłoszenie po tokenie linku płatności (64 znaki hex) — tylko pola potrzebne do płatności.
export async function appByPayToken(base44, token: string) {
  const t = String(token || "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(t)) return null;
  const rows = await runSql(
    base44,
    `SELECT a.id, a.full_name, a.email, a.pay_amount::float8 AS pay_amount, a.pay_expires_at, a.pay_order_id, a.paid_at,
            o.status AS order_status
       FROM public.powrot_applications a
       LEFT JOIN public.orders o ON o.id = a.pay_order_id
      WHERE a.pay_token = ${escStr(t)} LIMIT 1`,
    true
  );
  return rows && rows[0] ? rows[0] : null;
}

export const isPaid = (a) => !!a && (!!a.paid_at || a.order_status === "COMPLETED");
export const isExpired = (a) => !a?.pay_expires_at || new Date(a.pay_expires_at).getTime() < Date.now();

// Po opłaceniu (fulfillOrder): data płatności przy zgłoszeniu — panel pokazuje „Opłacone”.
export async function markPowrotPaid(base44, appId: string, orderId: string) {
  await runSql(
    base44,
    `UPDATE public.powrot_applications SET paid_at = COALESCE(paid_at, now()), pay_order_id = ${escStr(orderId)}, updated_date = now()
      WHERE id::text = ${escStr(String(appId))}`
  );
}
