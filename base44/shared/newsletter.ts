import { runSql, escStr } from "./supabase.ts";
import { loadAppUrl } from "./settings.ts";
import { sendMail } from "./smtp.ts";

// Listy powrotu — potwierdzenie zapisu (double opt-in).
// Nowy adres trafia jako „pending”; aktywny staje się dopiero po kliknięciu linku z e-maila.
// Niepotwierdzone po 7 dniach usuwa tick (eventsPublic → purgeUnconfirmed).

const esc = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const newToken = () => crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

export async function addSubscriber(base44, { email, name }) {
  const nameVal = name === undefined || name === null || String(name).trim() === "" ? "NULL" : escStr(String(name).trim().slice(0, 200));
  const token = newToken();
  // Adres już potwierdzony zostaje aktywny. Wracający (albo niepotwierdzony) dostaje świeży link —
  // przy „nic nie rób" ponowny zapis po wypisie nie dawał żadnej odpowiedzi ani maila.
  const rows = await runSql(
    base44,
    `INSERT INTO public.subscribers (id, email, name, status, confirm_token, confirm_sent_at)
     VALUES (gen_random_uuid()::text, ${escStr(String(email).toLowerCase())}, ${nameVal}, 'pending', ${escStr(token)}, NULL)
     ON CONFLICT (email) DO UPDATE SET
       status = 'pending', confirm_token = EXCLUDED.confirm_token, confirm_sent_at = NULL,
       name = COALESCE(EXCLUDED.name, public.subscribers.name), updated_date = now()
     WHERE public.subscribers.status <> 'active'
     RETURNING id`
  );
  // Błąd wysyłki nie może przerwać zamówienia ani zapisu na spotkanie.
  if (rows.length) await sendConfirmMail(base44, { email, name, token }).catch((e) => console.error("Listy: potwierdzenie", e.message));
}

export async function sendConfirmMail(base44, { email, name, token }) {
  const url = `${await loadAppUrl(base44)}/listy/potwierdz?t=${token}`;
  // confirm_sent_at ustawia bramka po faktycznej wysyłce (7 dni liczy się od niej).
  await sendMail(base44, {
    kind: "listy_potwierdzenie",
    to: email,
    subject: "Potwierdź zapis na Listy powrotu",
    html: `<div style="background:#0A0A0B;padding:40px 24px;font-family:Cinzel,Georgia,serif;color:#E2E2E2;">
      <div style="max-width:560px;margin:0 auto;">
        <p style="letter-spacing:3px;color:#C9A24A;font-size:12px;">EXMORTIS · LISTY POWROTU</p>
        <h1 style="font-size:24px;">Potwierdź zapis</h1>
        <p style="font-family:Arial,sans-serif;line-height:1.7;">${name ? esc(name) + ", " : ""}ktoś (mam nadzieję, że Ty) zapisał ten adres na Listy powrotu, jeden list w każdy poniedziałek. Żeby zacząć je dostawać, kliknij poniżej.</p>
        <p style="margin:32px 0;"><a href="${url}" style="background:#C9A24A;color:#0A0A0B;padding:14px 28px;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold;letter-spacing:2px;">POTWIERDZAM ZAPIS</a></p>
        <p style="font-family:Arial,sans-serif;color:#8A8A8C;font-size:13px;line-height:1.6;">Jeśli to nie Ty, zignoruj tę wiadomość. Bez potwierdzenia adres zostanie usunięty po 7 dniach.</p>
      </div></div>`,
  });
}

// Kliknięcie linku: aktywacja i data zgody = data kliknięcia.
// Klucz zostaje po potwierdzeniu, żeby powtórne kliknięcie (drugie urządzenie, ponowne otwarcie maila)
// pokazało „już potwierdzone” zamiast „link nieaktywny”. Zwraca { row, already }.
export async function confirmSubscriber(base44, token) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const rows = await runSql(
    base44,
    `UPDATE public.subscribers SET status = 'active', consent_date = now(), confirmed_at = now(), updated_date = now()
     WHERE confirm_token = ${escStr(token)} AND status = 'pending' RETURNING email, name, confirmed_at`
  );
  if (rows[0]) return { row: rows[0], already: false };
  const act = await runSql(base44, `SELECT email FROM public.subscribers WHERE confirm_token = ${escStr(token)} AND status = 'active' LIMIT 1`, true).catch(() => []);
  return act[0] ? { row: act[0], already: true } : null;
}

// Wypis z linku w mailu kampanii — bez logowania, sam token. Klucz zostaje, żeby link działał
// również przy powtórnym kliknięciu (wypis jest idempotentny).
export async function unsubscribeByToken(base44, token) {
  if (!/^[a-f0-9]{32}$/.test(String(token || ""))) return null;
  // Kolumnę zakłada panel newslettera przy pierwszym otwarciu — zanim to nastąpi, nie ma czego wypisywać.
  const rows = await runSql(
    base44,
    `UPDATE public.subscribers SET status = 'unsubscribed', updated_date = now()
     WHERE unsub_token = ${escStr(token)} RETURNING email`
  ).catch(() => []);
  return rows[0]?.email || null;
}

export async function purgeUnconfirmed(base44) {
  const r = await runSql(base44, `DELETE FROM public.subscribers WHERE status = 'pending' AND confirm_sent_at < now() - interval '7 days' RETURNING 1`);
  return r.length;
}