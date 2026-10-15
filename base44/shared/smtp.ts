import nodemailer from "npm:nodemailer@6.9.13";
import { FIRMA, getSetting, APP_URL, DEFAULT_APP_URL } from "./settings.ts";
import { emailLayout } from "./emailLayout.ts";
import { runSql, escStr } from "./supabase.ts";

// JEDYNA bramka wysyłki maili. Wysyła tylko, gdy wysyłka ma status „dziala” (po udanym teście).
// W przeciwnym razie mail trafia do kolejki „Oczekuje na konfigurację” (MailQueue) — nic nie ginie.

export const mailReady = (s) => !!(s && s.status === "dziala" && s.host && s.user && s.password);

let CFG = null, CFG_AT = 0;
export async function mailConfig(base44) {
  if (CFG_AT && Date.now() - CFG_AT < 30000) return CFG;
  CFG = await getSetting(base44, "smtp").catch(() => null);
  CFG_AT = Date.now();
  return CFG;
}
let MCFG = null, MCFG_AT = 0;
export async function mailConfigMarketing(base44) {
  if (MCFG_AT && Date.now() - MCFG_AT < 30000) return MCFG;
  MCFG = await getSetting(base44, "smtp_marketing").catch(() => null);
  MCFG_AT = Date.now();
  return MCFG;
}
export const resetMailConfig = () => { CFG_AT = 0; MCFG_AT = 0; };

// Listy powrotu i ogłoszenia idą osobnym kanałem (np. Brevo), jeśli jest skonfigurowany i przetestowany.
// Simply.com zabrania wysyłki newsletterów przez zwykłą skrzynkę — a reputacja skrzynki transakcyjnej
// (zamówienia, linki do spotkań) jest ważniejsza niż newsletter.
const MARKETING_KINDS = new Set(["listy", "ogloszenie"]);

// Akcje wyłącznie mailowe (ogłoszenia, ręczne przypomnienia) — bez działającej wysyłki odmawiamy jawnie.
export async function requireMail(base44) {
  if (!mailReady(await getSetting(base44, "smtp").catch(() => null))) throw new Error("Wymaga skonfigurowanej wysyłki e-mail (Ustawienia → Wysyłka e-mail).");
}

// Adres do powiadomień administracyjnych.
export async function adminTo(base44) {
  const s = await mailConfig(base44);
  return FIRMA?.email || s?.reply_to || s?.from || null;
}

// Wersja tekstowa (multipart/alternative) — maile z samym HTML filtry antyspamowe oceniają gorzej.
export function htmlToText(html) {
  return String(html || "")
    .replace(/<(style|script|head)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, t) => {
      const txt = t.replace(/<[^>]+>/g, "").trim();
      return !txt ? href : txt === href || href.startsWith("mailto:") || href.startsWith("tel:") ? txt : `${txt} (${href})`;
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|table|blockquote)>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ")
    .trim();
}

// Limit dostawcy: Simply.com blokuje skrzynkę po ponad 300 mailach w 2 godziny (smtp.simply.com).
// Trzymamy się poniżej: najwyżej MAIL_BUDGET wysłanych w ostatnich 2 h; nadwyżka czeka w kolejce
// z oznaczeniem LIMIT_MARK i wychodzi sama (zadanie cykliczne), gdy limit się zwolni.
export const MAIL_BUDGET = 240;
export const LIMIT_MARK = "Czeka na limit wysyłki (najwyżej 240 maili na 2 godziny)";
let SENT = { at: 0, n: 0 };
async function sentLast2h(base44) {
  if (Date.now() - SENT.at < 30000) return SENT.n;
  const since = new Date(Date.now() - 2 * 3600e3).toISOString();
  const rows = await base44.asServiceRole.entities.MailQueue
    .filter({ status: "wyslany", sent_at: { $gte: since } }, "-created_date", 1000).catch(() => null);
  SENT = { at: Date.now(), n: rows ? rows.filter((r) => r.blad !== "kanał: newsletter").length : SENT.n };
  return SENT.n;
}
export async function mailBudgetLeft(base44) { return Math.max(0, MAIL_BUDGET - await sentLast2h(base44)); }

// Bezpośrednie wysłanie przez SMTP (bez bramki) — test i wysyłka zaległych.
export async function smtpSend(smtp, { to, subject, html, attachments, headers, kind = "", preheader = "" }) {
  if (!smtp || !smtp.host || !smtp.user || !smtp.password) throw new Error("Wysyłka e-mail nie jest skonfigurowana");
  const port = Number(smtp.port) || 587;
  const transporter = nodemailer.createTransport({
    host: smtp.host, port, secure: port === 465,
    auth: { user: smtp.user, pass: smtp.password },
  });
  const addr = smtp.from || smtp.user;
  const unsubUrl = String(headers?.["List-Unsubscribe"] || "").replace(/^<|>$/g, "");
  const full = emailLayout(html, {
    firma: FIRMA, kind, preheader, unsubUrl,
    appUrl: APP_URL && APP_URL !== DEFAULT_APP_URL ? APP_URL : "https://exmortis.pl",
  });
  await transporter.sendMail({
    from: `"${String(smtp.from_name || "exmortis").replace(/"/g, "")}" <${addr}>`,
    ...(smtp.reply_to ? { replyTo: smtp.reply_to } : {}),
    to, subject,
    html: full,
    text: htmlToText(full.replace(/^[\s\S]*?<body[^>]*>/, "").replace(/<div style="display:none[^>]*>[\s\S]*?<\/div>/, "")),
    ...(headers && typeof headers === "object" ? { headers } : {}),
    ...(Array.isArray(attachments) && attachments.length > 0 ? { attachments } : {}),
  });
}

// Wysyłka wielu wiadomości naraz (partiami) — sekwencyjna pętla przy setce odbiorców przekracza czas życia
// funkcji i urywa się w połowie, zostawiając część osób bez wiadomości. Kolejność nie ma tu znaczenia.
export async function inPool(items, fn, n = 6) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const item = items[i++]; await fn(item); }
  }));
}

// Skutki faktycznej wysyłki (np. 7 dni na potwierdzenie Listów liczy się od wysłania).
export async function afterSent(base44, kind, to) {
  if (kind === "listy_potwierdzenie") {
    await runSql(base44, `UPDATE public.subscribers SET confirm_sent_at = now() WHERE email = ${escStr(String(to).toLowerCase())} AND status = 'pending'`).catch(() => {});
  }
}

// Zwraca "wyslany" albo "kolejka". Błąd SMTP jest zapisywany w dzienniku i rzucany dalej.
export async function sendMail(base44, { to, subject, html, attachments, kind = "inne", ref, waznyDo, headers, preheader = "" }) {
  if (!to) throw new Error("Brak adresata");
  const Q = base44.asServiceRole.entities.MailQueue;
  const base = { to_email: String(to || ""), subject, kind, ...(ref ? { ref: String(ref) } : {}), ...(waznyDo ? { wazny_do: new Date(waznyDo).toISOString() } : {}) };
  let smtp = await mailConfig(base44);
  let viaMarketing = false;
  if (MARKETING_KINDS.has(kind)) {
    const m = await mailConfigMarketing(base44);
    // Ten sam serwer co skrzynka główna (np. oba na Simply) to nie jest osobny kanał — obowiązuje limit skrzynki.
    if (mailReady(m) && String(m.host || "").toLowerCase() !== String(smtp?.host || "").toLowerCase()) { smtp = m; viaMarketing = true; }
  }
  if (!mailReady(smtp)) {
    await Q.create({ ...base, html, attachments: attachments || [], status: "kolejka" });
    return "kolejka";
  }
  if (!viaMarketing && await sentLast2h(base44) >= MAIL_BUDGET) {
    await Q.create({ ...base, html, attachments: attachments || [], status: "kolejka", blad: LIMIT_MARK, ...(headers ? { headers } : {}) });
    return "kolejka";
  }
  try {
    await smtpSend(smtp, { to, subject, html, attachments, headers, kind, preheader });
    if (!viaMarketing) SENT.n++;
  } catch (e) {
    await Q.create({ ...base, html, attachments: attachments || [], status: "blad", blad: String(e?.message || e).slice(0, 500) });
    throw e;
  }
  // Wysłane kanałem marketingowym nie liczą się do limitu skrzynki Simply (status „wyslany” + znacznik).
  await Q.create({ ...base, status: "wyslany", sent_at: new Date().toISOString(), ...(viaMarketing ? { blad: "kanał: newsletter" } : {}) });
  await afterSent(base44, kind, to);
  return "wyslany";
}

// Wysyłka zaległych (tylko na kliknięcie administratora), partiami.
export async function flushMailQueue(base44, { auto = false } = {}) {
  const smtp = await getSetting(base44, "smtp");
  if (!mailReady(smtp)) { if (auto) return { sent: 0, skipped: 0, failed: 0, more: false }; throw new Error("Wysyłka e-mail nie działa — najpierw wyślij udany test."); }
  const Q = base44.asServiceRole.entities.MailQueue;
  SENT.at = 0;
  const budget = Math.min(auto ? 40 : 20, await mailBudgetLeft(base44));
  if (budget <= 0) return { sent: 0, skipped: 0, failed: 0, more: true, limit: true };
  // Automatycznie wychodzą tylko maile wstrzymane przez limit; pozostałe zaległe — na kliknięcie administratora.
  const items = await Q.filter(auto ? { status: "kolejka", blad: LIMIT_MARK } : { status: "kolejka" }, "created_date", budget);
  let sent = 0, skipped = 0, failed = 0;
  for (const m of items) {
    if (m.wazny_do && new Date(m.wazny_do) < new Date()) {
      await Q.update(m.id, { status: "pominiety", blad: "Termin minął", html: "", attachments: [] });
      skipped++;
      continue;
    }
    try {
      await smtpSend(smtp, { to: m.to_email, subject: m.subject, html: m.html || "", attachments: m.attachments, headers: m.headers, kind: m.kind });
      SENT.n++;
      await Q.update(m.id, { status: "wyslany", sent_at: new Date().toISOString(), html: "", attachments: [], blad: "" });
      await afterSent(base44, m.kind, m.to_email);
      sent++;
    } catch (e) {
      await Q.update(m.id, { status: "blad", blad: String(e?.message || e).slice(0, 500) });
      failed++;
    }
  }
  const left = await Q.filter(auto ? { status: "kolejka", blad: LIMIT_MARK } : { status: "kolejka" }, "created_date", 1);
  return { sent, skipped, failed, more: left.length > 0 };
}

const escHtml = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const zl = (n) => `${Number(n || 0).toFixed(2).replace(".", ",")} zł`;

// Potwierdzenie zamówienia (trwały nośnik): pozycje, numer zamówienia, Regulamin i odstąpienie.
export function orderEmailHtml(buyerName, items, total, orderId = "", invoice = null) {
  const rows = items
    .map(
      (p) =>
        `<tr><td style="padding:8px 0;color:#E2E2E2;">${escHtml(p.name)} × ${Number(p.quantity) || 1}</td><td style="padding:8px 0;text-align:right;color:#C9A24A;">${zl((Number(p.quantity) || 1) * Number(p.unitPrice) / 100)}</td></tr>`
    )
    .join("");
  const nr = orderId ? String(orderId).slice(0, 8).toUpperCase() : "";
  return `
  <div style="background:#0A0A0B;padding:32px;font-family:Georgia,serif;color:#E2E2E2;">
    <p style="letter-spacing:4px;color:#C9A24A;font-size:13px;">EXMORTIS</p>
    <h1 style="font-size:26px;letter-spacing:1px;">Próg przekroczony</h1>
    <p style="color:#8A8A8C;line-height:1.7;">${escHtml(buyerName)}, Twoja płatność została przyjęta. Szczegóły poniżej — pierwszy ruch jest już za Tobą.</p>
    ${nr ? `<p style="color:#8A8A8C;font-size:13px;">Numer zamówienia: <span style="color:#E2E2E2;">${nr}</span> (pełny: ${escHtml(orderId)})</p>` : ""}
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">${rows}
      <tr><td style="padding-top:12px;border-top:1px solid #3D3D3F;color:#8A8A8C;">RAZEM</td>
      <td style="padding-top:12px;border-top:1px solid #3D3D3F;text-align:right;color:#C9A24A;font-size:18px;">${zl(total)}</td></tr>
    </table>
    ${invoice && invoice.nip ? `<p style="color:#8A8A8C;font-size:13px;line-height:1.6;">Dane do faktury: <span style="color:#E2E2E2;">${escHtml(invoice.company)}, NIP ${escHtml(invoice.nip)}, ${escHtml(invoice.address)}</span><br>Fakturę wyślę osobno na ten adres e-mail.</p>` : ""}
    <p style="color:#8A8A8C;font-size:13px;line-height:1.6;"><a href="${APP_URL}/regulamin" style="color:#C9A24A;">Regulamin</a> · <a href="${APP_URL}/odstapienie" style="color:#C9A24A;">Odstąpienie od umowy (formularz)</a></p>
    <p style="color:#5C5C5E;font-size:12px;letter-spacing:2px;">WRACAM Z SIEBIE · UCZĘ WRACAĆ</p>
  </div>`;
}

// Treść kampanii newslettera. Oprawa (logo, stopka, wypis jednym kliknięciem) — w emailLayout;
// adres wypisu przychodzi w nagłówku List-Unsubscribe (adminNewsletter).
export function campaignEmailHtml(content, name, _unsubUrl = "", { cta_label = "", cta_url = "" } = {}) {
  const greeting = name ? `<p style="margin:0 0 18px;">${escHtml(name)},</p>` : "";
  const cta = cta_label && /^https?:\/\//.test(cta_url)
    ? `<p><a href="${escHtml(cta_url)}">${escHtml(cta_label)}</a></p>` : "";
  return `${greeting}<div>${content}</div>${cta}`;
}
