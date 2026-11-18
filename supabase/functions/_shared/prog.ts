// Rozmowa na progu (18.11.2026) — wspólne: pytania, tokeny płatności, synchronizacja statusów, wiadomości.
// Osobna usługa, niezależna od programu POWRÓT. Dane w prog_applications / prog_log / prog_summaries.
// Mechanizmy wspólne z POWRÓT: szablon e-maili (wrap), przycisk, przypomnienia (powrotReminders), pakiet + kalendarz.
import { runSql, escStr } from "./supabase.ts";
import { sendMail, adminTo } from "./smtp.ts";
import { loadAppUrl } from "./settings.ts";
import { emailButton } from "./emailLayout.ts";
import { wrap, escHtml, firstName } from "./powrotSurvey.ts";
import { sha256hex } from "./booking.ts";

export const PROG_SLUG = "rozmowa-na-progu";
export const PAY_DAYS = 7;

export const OBSZARY = ["praca", "relacje", "ważna decyzja", "zmiana życiowa", "poczucie kierunku", "inne"];

export const PYTANIA = [
  { key: "sprawa", label: "Z jaką główną sprawą przychodzisz na spotkanie?", max: 2000, required: true },
  { key: "dlaczego_teraz", label: "Co sprawia, że chcesz porozmawiać o niej właśnie teraz?", max: 2000, required: true },
  { key: "zrozumiec", label: "Co chcesz lepiej zrozumieć po naszym spotkaniu?", max: 2000, required: true },
  { key: "obszar", label: "Który obszar najlepiej opisuje Twoją sytuację?", max: 40, required: true },
  { key: "bez_tematow", label: "Czy są tematy, których nie chcesz poruszać?", max: 1000, required: false },
];

export const SCOPE_TEXT =
  "Rozumiem, że Rozmowa na progu jest spotkaniem mentoringowym. Nie jest psychoterapią, diagnozą ani pomocą w kryzysie. Jeśli potrzebuję pilnej pomocy, skorzystam z numerów 116 123, 800 70 2222 albo 112.";

export const STATUS_LABEL: Record<string, string> = {
  do_platnosci: "Czeka na płatność",
  oplacone: "Opłacone — wybór terminu",
  termin_wybrany: "Termin zarezerwowany",
  odbyta: "Spotkanie odbyte",
  nieobecnosc: "Nieobecność",
  anulowana: "Odwołane",
  zamkniete: "Zamknięte",
};

export function newToken() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
export const tokenOk = (t: unknown) => /^[a-f0-9]{64}$/.test(String(t ?? "").trim().toLowerCase());
export const tokenHash = (t: string) => sha256hex(`prog:${String(t).trim().toLowerCase()}`);

export async function progLog(base44, id: string, kind: string, summary: string, actor = "system", from: string | null = null, to: string | null = null) {
  await runSql(base44, `INSERT INTO public.prog_log (application_id, kind, from_status, to_status, summary, actor)
    VALUES (${escStr(id)}, ${escStr(kind)}, ${from ? escStr(from) : "NULL"}, ${to ? escStr(to) : "NULL"}, ${escStr(summary)}, ${escStr(actor)})`).catch(() => {});
}

export async function progProductId(base44): Promise<string> {
  const r = await runSql(base44, `SELECT id::text AS id FROM public.products WHERE slug = ${escStr(PROG_SLUG)} LIMIT 1`, true).catch(() => []);
  return r && r[0] ? String(r[0].id) : "";
}

// Ważny token płatności → zgłoszenie (status „do_platnosci”, termin nieminiony) albo null.
export async function appByToken(base44, token: string) {
  if (!tokenOk(token)) return null;
  const h = await tokenHash(token);
  const r = await runSql(base44, `SELECT id, full_name, email, status, pay_expires_at, pay_expires_at > now() AS valid
    FROM public.prog_applications WHERE pay_token_hash = ${escStr(h)} LIMIT 1`, true);
  return r && r[0] ? r[0] : null;
}

// Statusy wynikają z zamówienia, pakietu i rezerwacji — liczone przy odczycie (bez zmian w realizacji zamówień).
export async function progSync(base44) {
  const moved: Array<{ id: string; from: string; to: string }> = [];
  const run = async (sql: string, from: string, to: string) => {
    const r = await runSql(base44, sql).catch((e) => { console.error("progSync:", String(e?.message || e).slice(0, 200)); return []; });
    for (const x of r || []) moved.push({ id: String(x.id), from, to });
  };
  // Opłacone zamówienie → „oplacone” + numer zamówienia i pakietu.
  await run(`UPDATE public.prog_applications a SET status = 'oplacone', status_at = now(), updated_date = now(), order_id = o.id,
      package_id = COALESCE(a.package_id, (SELECT pk.id FROM public.bk_packages pk WHERE pk.order_id = o.id ORDER BY pk.created_at DESC LIMIT 1))
    FROM public.orders o WHERE o.prog_app_id = a.id AND o.status = 'COMPLETED' AND a.status = 'do_platnosci' RETURNING a.id`, "do_platnosci", "oplacone");
  // Pakiet utworzony później niż oznaczenie płatności.
  await runSql(base44, `UPDATE public.prog_applications a SET package_id = pk.id FROM public.bk_packages pk
    WHERE a.package_id IS NULL AND a.order_id IS NOT NULL AND pk.order_id = a.order_id`).catch(() => {});
  // Najnowsza rezerwacja z pakietu wyznacza stan spotkania.
  const latest = `(SELECT DISTINCT ON (k.package_id) k.package_id, k.id, k.status FROM public.bk_bookings k
    WHERE k.package_id IS NOT NULL ORDER BY k.package_id, k.created_at DESC)`;
  const map: Array<[string, string, string]> = [
    ["POTWIERDZONA", "termin_wybrany", "('oplacone','anulowana')"],
    ["ODBYLA_SIE", "odbyta", "('oplacone','termin_wybrany')"],
    ["NIEOBECNOSC", "nieobecnosc", "('oplacone','termin_wybrany')"],
  ];
  for (const [bk, to, fromSet] of map) {
    await run(`UPDATE public.prog_applications a SET status = ${escStr(to)}, status_at = now(), updated_date = now(), booking_id = l.id
      FROM ${latest} l WHERE l.package_id = a.package_id AND a.status IN ${fromSet} AND l.status = ${escStr(bk)} RETURNING a.id`, "", to);
  }
  // Odwołanie (przez klienta albo administratora), gdy nie ma innej aktywnej rezerwacji.
  await run(`UPDATE public.prog_applications a SET status = 'anulowana', status_at = now(), updated_date = now()
    FROM ${latest} l WHERE l.package_id = a.package_id AND a.status = 'termin_wybrany'
      AND l.status IN ('ANULOWANA_KLIENT','ANULOWANA_ADMIN') RETURNING a.id`, "termin_wybrany", "anulowana");
  // Po spotkaniu: podsumowanie czeka (gdy uczestnik go chce).
  await runSql(base44, `INSERT INTO public.prog_summaries (application_id)
    SELECT a.id FROM public.prog_applications a WHERE a.status = 'odbyta' AND a.podsumowanie_chce
    ON CONFLICT (application_id) DO NOTHING`).catch(() => {});
  for (const m of moved) await progLog(base44, m.id, "status", `Status: ${STATUS_LABEL[m.to] || m.to}`, "system", m.from || null, m.to);
  return moved.length;
}

// Przypomnienie dla prowadzącego: podsumowanie nieudostępnione 24 h po spotkaniu (raz na podsumowanie).
export async function progSummaryReminder(base44) {
  await progSync(base44);
  const rows = await runSql(base44, `SELECT s.id, a.full_name, k.ends_at FROM public.prog_summaries s
      JOIN public.prog_applications a ON a.id = s.application_id
      LEFT JOIN public.bk_bookings k ON k.id = a.booking_id
    WHERE s.status IN ('oczekuje','przygotowywane') AND s.reminded_at IS NULL
      AND COALESCE(k.ends_at, a.status_at) < now() - interval '24 hours'
    ORDER BY COALESCE(k.ends_at, a.status_at) LIMIT 20`, true);
  if (!rows.length) return 0;
  const to = await adminTo(base44);
  if (!to) return 0;
  const took = await runSql(base44, `UPDATE public.prog_summaries SET reminded_at = now()
    WHERE id IN (${rows.map((r) => escStr(r.id)).join(", ")}) AND reminded_at IS NULL RETURNING id`);
  if (!took.length) return 0;
  const url = await loadAppUrl(base44);
  await sendMail(base44, {
    kind: "prog_admin_przypomnienie", to,
    subject: `Rozmowa na progu: podsumowanie czeka ponad 24 godziny (${took.length})`,
    html: wrap(`<p>Po tych spotkaniach uczestnicy chcą pisemnego podsumowania. Na stronie obiecujesz je w ciągu 48 godzin.</p>
      <ul style="line-height:1.6;">${rows.filter((r) => took.some((t) => String(t.id) === String(r.id))).map((r) => `<li>${escHtml(r.full_name || "(bez imienia)")}</li>`).join("")}</ul>
      <p style="margin:28px 0">${emailButton("Otwórz panel", `${url}/admin/rozmowa`)}</p>`),
  });
  return took.length;
}

// ===== Wiadomości do uczestnika =====
const podpis = "<p>Dawid<br>EXMORTIS</p>";

export function mailZgloszenie(name: string, payUrl: string, terminy: string) {
  return {
    subject: "Rozmowa na progu — zgłoszenie przyjęte",
    html: wrap(`<p>${escHtml(firstName(name)) || "Dzień dobry"}, dziękuję za zgłoszenie na Rozmowę na progu.</p>
      <p>Twoje odpowiedzi pomogą mi przygotować się do spotkania. Kolejny krok to płatność (799 zł), a po niej wybór terminu w kalendarzu.</p>
      ${terminy ? `<p>${escHtml(terminy)}</p>` : ""}
      <p style="margin:28px 0">${emailButton("Przejdź do płatności", payUrl)}</p>
      <p>Link do płatności jest osobisty i ważny ${PAY_DAYS} dni. Jeśli zmienisz zdanie, nie musisz nic robić.</p>
      <p style="font-size:14px;color:#8A8A8C">Rozmowa na progu jest spotkaniem mentoringowym. Nie jest psychoterapią, diagnozą ani pomocą w kryzysie.</p>
      ${podpis}`),
  };
}

export function mailWiadomosc(name: string, tresc: string, url: string) {
  return {
    subject: "Rozmowa na progu — wiadomość od Dawida",
    html: wrap(`<p>${escHtml(firstName(name)) || "Dzień dobry"},</p>
      ${String(tresc).split(/\n{2,}/).map((p) => `<p>${escHtml(p).replace(/\n/g, "<br>")}</p>`).join("")}
      ${url ? `<p style="margin:28px 0">${emailButton("Otwórz konto", url)}</p>` : ""}
      ${podpis}`),
  };
}

export function mailPodsumowanie(name: string, email: string, url: string) {
  return {
    subject: "Rozmowa na progu — podsumowanie spotkania jest gotowe",
    html: wrap(`<p>${escHtml(firstName(name)) || "Dzień dobry"}, przygotowałem pisemne podsumowanie naszego spotkania.</p>
      <p>Znajdziesz je w swoim koncie na exmortis.pl, w sekcji „Rozmowa na progu”. Ze względu na poufność treść podsumowania nie jest wysyłana w wiadomości e-mail.</p>
      <p style="margin:28px 0">${emailButton("Otwórz podsumowanie", `${url}/konto?tab=rozmowa`)}</p>
      <p>Jeśli nie masz jeszcze konta, możesz je założyć na adres ${escHtml(email)}. Podsumowanie pojawi się po zalogowaniu.</p>
      ${podpis}`),
  };
}

export async function sendProg(base44, kind: string, ref: string, to: string, m: { subject: string; html: string }) {
  return await sendMail(base44, { kind, ref, to, subject: m.subject, html: m.html });
}

// Retencja (polityka prywatności, pkt 10a): zgłoszenie bez zakupu — 6 miesięcy; po spotkaniu — 12 miesięcy.
// Zamówienia zostają (rozliczenia); usuwane jest zgłoszenie z ankietą, historią i podsumowaniem.
export async function progRetention(base44) {
  const cond = `((status IN ('do_platnosci','zamkniete') AND order_id IS NULL AND created_date < now() - interval '6 months')
      OR (status IN ('odbyta','nieobecnosc','anulowana','zamkniete') AND status_at < now() - interval '12 months'))`;
  await runSql(base44, `UPDATE public.orders o SET prog_app_id = NULL FROM public.prog_applications a WHERE o.prog_app_id = a.id AND ${cond.replace(/\b(status|order_id|created_date|status_at)\b/g, "a.$1")}`).catch(() => {});
  const r = await runSql(base44, `DELETE FROM public.prog_applications WHERE ${cond} RETURNING 1`).catch(() => []);
  return r.length;
}
