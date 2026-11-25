// E-maile biblioteki i wiadomości — przez istniejącą kolejkę (bez SMTP czekają, nic nie ginie).

import { runSql, rpc, escStr } from "./supabase.ts";
import { sendMail } from "./smtp.ts";
import { loadAppUrl } from "./settings.ts";
import { resolveRecipients, libSettings, inBatches } from "./libraryAccess.ts";
import { sanitizeHtml } from "./librarySanitize.ts";

export const FOOTER_REPLY = "Na tę wiadomość odpowiesz e-mailem lub na WhatsAppie.";
export const FOOTER_CRISIS = "Jeśli jesteś w kryzysie: 116 123 · 800 70 2222 (całą dobę, bezpłatnie) · 112.";

// Ile wiadomości leci naraz. Wcześniej szły jedna po drugiej: przy 500 odbiorcach
// to kilkanaście minut i przerwanie zadania w połowie wysyłki.
const SEND_BATCH = 6;

// {imię} → imię. Brak imienia = zdanie bez pustego miejsca („Cześć {imię}," → „Cześć,").
// {imię} → imię. Bez imienia znacznik znika razem z odstępem, a zdanie zaczyna się wielką literą
// („<p>dziękuję", nie „<p> dziękuję").
export function renderBody(html, name) {
  const n = String(name || "").trim();
  const token = /\{\s*imi[ęe]\s*\}/gi;
  let out = String(html == null ? "" : html);
  if (n) {
    out = out.replace(token, n);
  } else {
    out = out
      .replace(new RegExp(`(^|>)(\\s*)${token.source}\\s*([,.!?;:]+\\s*)?([a-ząćęłńóśźż])?`, "gi"),
        (m, lead, sp, punct, ch) => lead + (lead === ">" ? "" : sp) + String(ch || "").toUpperCase())
      .replace(token, "");
  }
  return out.replace(/[ \t]{2,}/g, " ").replace(/\s+([,.!?;:])/g, "$1").replace(/\s+(<)/g, "$1");
}

const wrap = (title, inner, appUrl) => `<div style="font-family:Arial,Helvetica,sans-serif;color:#E3E3E3;background:#0A0A0B;padding:24px">
  <p style="font-size:12px;letter-spacing:.18em;color:#C9A24A;margin:0 0 12px">EXMORTIS</p>
  <h1 style="font-size:20px;color:#F5EFE1;margin:0 0 16px">${title}</h1>
  ${inner}
  <p style="font-size:13px;color:#8A8A8C;margin:24px 0 0">${FOOTER_REPLY}<br>${FOOTER_CRISIS}</p>
  <p style="font-size:12px;color:#8A8A8C;margin:16px 0 0"><a href="${appUrl}/konto" style="color:#C9A24A">exmortis.pl · Moje konto</a></p>
</div>`;

// Kopia wiadomości: BRAK nic nie wysyła, POWIADOMIENIE bez treści, PEŁNA z treścią.
export async function sendMessageEmail(base44, message, emails) {
  if (!message || message.email_mode === "BRAK" || !emails || !emails.length) return { sent: 0 };
  const appUrl = await loadAppUrl(base44);
  const title = message.title ? String(message.title) : "Nowa wiadomość";
  const html = message.email_mode === "PELNA"
    ? wrap(title, `<div style="font-size:15px;line-height:1.7">${sanitizeHtml(message.body_html)}</div>`, appUrl)
    : wrap("Masz nową wiadomość na exmortis.pl", `<p style="font-size:15px;line-height:1.7">Zaloguj się, aby ją przeczytać.</p>`, appUrl);
  const subject = message.email_mode === "PELNA" ? title : "Masz nową wiadomość na exmortis.pl";
  const results = await inBatches(emails.slice(0, 500), SEND_BATCH, (to) => sendMail(base44, {
    to, subject, html, kind: "biblioteka_wiadomosc", ref: String(message.id || ""),
  }).catch(() => null));
  return { sent: results.filter(Boolean).length };
}

// Wypisanie z e-maili o nowych materiałach (Moje konto → Ustawienia). Tabela tylko dla funkcji serwera.
let optoutReady = false;
export async function ensureMailOptout(base44) {
  if (optoutReady) return;
  await runSql(base44, `CREATE TABLE IF NOT EXISTS public.mb_mail_optout (
      email text PRIMARY KEY CHECK (email = lower(btrim(email)) AND length(email) <= 320),
      created_at timestamptz NOT NULL DEFAULT now())`);
  await runSql(base44, `ALTER TABLE public.mb_mail_optout ENABLE ROW LEVEL SECURITY`);
  await runSql(base44, `REVOKE ALL ON public.mb_mail_optout FROM anon, authenticated`);
  optoutReady = true;
}
export async function mailOptedOut(base44, email: string) {
  await ensureMailOptout(base44);
  const r = await runSql(base44, `SELECT 1 FROM public.mb_mail_optout WHERE email = ${escStr(String(email || "").toLowerCase())}`, true);
  return !!(r && r.length);
}
export async function setMailOptout(base44, email: string, off: boolean) {
  await ensureMailOptout(base44);
  const e = escStr(String(email || "").toLowerCase());
  await runSql(base44, off
    ? `INSERT INTO public.mb_mail_optout (email) VALUES (${e}) ON CONFLICT DO NOTHING`
    : `DELETE FROM public.mb_mail_optout WHERE email = ${e}`);
}

const esc = (t) => String(t || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// E-mail o nowych materiałach — jeden na osobę.
// • Materiały dla grupy „Wszystkie konta” (np. nagrania z Wieczorów powrotu, 25.11.2026): e-mail idzie zawsze,
//   z tytułami i przyciskiem do Biblioteki — to treść ogólnodostępna dla zalogowanych.
// • Pozostałe przydziały (osobiste, grupy zamknięte): tylko gdy w ustawieniach Biblioteki włączono
//   „E-mail o nowych materiałach”, jak dotąd bez tytułów i bez treści.
// Osoby wypisane w ustawieniach konta nie dostają żadnego z tych e-maili.
export async function sendAssignmentDigests(base44) {
  const s = await libSettings(base44, true);
  const rows = await runSql(base44, `SELECT a.id, a.material_id, a.collection_id, a.target_kind, a.target_email, a.group_id, a.group_mode,
      a.snapshot_emails, a.exceptions_add, a.exceptions_drop,
      (g.kind = 'AUTOMATYCZNA' AND g.rule->>'typ' = 'wszystkie_konta') AS publiczny,
      COALESCE(m.title, c.title) AS tytul, m.kind AS rodzaj
    FROM public.mb_assignments a
    LEFT JOIN public.mb_groups g ON g.id = a.group_id
    LEFT JOIN public.mb_materials m ON m.id = a.material_id
    LEFT JOIN public.mb_collections c ON c.id = a.collection_id
    WHERE a.notified_at IS NULL AND a.revoked_at IS NULL AND a.created_at > now() - interval '2 days'
      AND (a.visible_from IS NULL OR a.visible_from <= now())
      AND (a.visible_to IS NULL OR a.visible_to > now())
      AND (a.material_id IS NULL OR m.deleted_at IS NULL)
      AND (a.collection_id IS NULL OR c.deleted_at IS NULL)
      ${s.email_notify ? "" : "AND g.kind = 'AUTOMATYCZNA' AND g.rule->>'typ' = 'wszystkie_konta'"}
    ORDER BY a.created_at LIMIT 200`, true);
  if (!rows || !rows.length) return { wyslane: 0, przydzialy: 0, pominiete: !s.email_notify };

  await ensureMailOptout(base44);
  const out = await runSql(base44, `SELECT email FROM public.mb_mail_optout`, true).catch(() => []);
  const optout = new Set((out || []).map((r) => String(r.email || "").toLowerCase()));

  const perPerson = new Map(); // e-mail → { n, titles: [] }
  const ids = [];
  for (const a of rows) {
    ids.push(a.id);
    const target = a.target_kind === "osoba"
      ? { kind: "osoba", emails: [a.target_email] }
      : { kind: "grupa", group_id: a.group_id, group_mode: a.group_mode, snapshot_emails: a.snapshot_emails || [], exceptions_add: a.exceptions_add || [], exceptions_drop: a.exceptions_drop || [] };
    const people = await resolveRecipients(base44, target).catch(() => []);
    for (const p of people || []) {
      const e = String(p.email || "").toLowerCase();
      if (!e || optout.has(e)) continue;
      const cur = perPerson.get(e) || { n: 0, titles: [], name: p.name || p.imie || "" };
      cur.n += 1;
      if (a.publiczny && a.tytul && !cur.titles.some((x) => x.t === a.tytul)) cur.titles.push({ t: a.tytul, k: a.rodzaj });
      perPerson.set(e, cur);
    }
  }
  const appUrl = await loadAppUrl(base44);
  const libUrl = `${appUrl}/konto?tab=biblioteka`;
  const btn = (href, label) => `<p style="margin:22px 0 0"><a href="${href}" style="display:inline-block;background:#C9A24A;color:#0A0A0B;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 22px;border-radius:10px">${label}</a></p>`;
  const optoutLine = `<p style="font-size:12px;color:#8A8A8C;margin:18px 0 0">Nie chcesz takich wiadomości? Wyłączysz je w <a href="${appUrl}/konto?tab=ustawienia" style="color:#C9A24A">Moje konto → Ustawienia</a>.</p>`;
  const results = await inBatches([...perPerson], SEND_BATCH, ([email, info]) => {
    const pub = info.titles;
    const nagranie = pub.length > 0 && pub.every((x) => x.k === "WIDEO" || x.k === "AUDIO");
    let subject; let html;
    if (pub.length) {
      subject = pub.length === 1
        ? `${nagranie ? "Nowe nagranie" : "Nowy materiał"} w Bibliotece: ${pub[0].t}`
        : `${nagranie ? "Nowe nagrania" : "Nowe materiały"} w Twojej Bibliotece`;
      const list = `<ul style="font-size:15px;line-height:1.7;padding-left:18px;margin:12px 0 0">${pub.map((x) => `<li style="color:#F5EFE1">${esc(x.t)}</li>`).join("")}</ul>`;
      html = wrap(nagranie ? (pub.length === 1 ? "Nowe nagranie czeka w Bibliotece" : "Nowe nagrania czekają w Bibliotece") : "Nowe materiały w Bibliotece",
        `<p style="font-size:15px;line-height:1.7;margin:0">Dodałem do Biblioteki na exmortis.pl:</p>${list}
         <p style="font-size:15px;line-height:1.7;margin:14px 0 0">Znajdziesz ${pub.length === 1 ? "go" : "je"} po zalogowaniu na swoje konto — w Bibliotece, kiedy zechcesz.</p>
         ${btn(libUrl, nagranie ? "Obejrzyj w Bibliotece" : "Otwórz Bibliotekę")}${optoutLine}`, appUrl);
    } else {
      subject = "Nowe materiały w Twojej bibliotece";
      html = wrap("Masz nowe materiały w bibliotece",
        `<p style="font-size:15px;line-height:1.7">W Twojej bibliotece ${info.n === 1 ? "pojawił się nowy materiał" : `pojawiły się nowe materiały (${info.n})`}.</p>${btn(libUrl, "Otwórz Bibliotekę")}${optoutLine}`,
        appUrl);
    }
    return sendMail(base44, { to: email, subject, html, kind: pub.length ? "biblioteka_nagranie" : "biblioteka_material" }).catch(() => null);
  });
  const sent = results.filter(Boolean).length;
  if (ids.length) {
    await runSql(base44, `UPDATE public.mb_assignments SET notified_at = now()
      WHERE id IN (${ids.map((i) => escStr(i) + "::uuid").join(",")})`).catch(() => {});
  }
  return { wyslane: sent, przydzialy: ids.length, osoby: perPerson.size };
}

function sqlArr(v) {
  const a = Array.isArray(v) ? v.map((x) => String(x || "").toLowerCase()).filter(Boolean) : [];
  return a.length ? `ARRAY[${a.map(escStr).join(",")}]::text[]` : `'{}'::text[]`;
}

// Atomowe przejęcie i wysyłka jednej wiadomości. Ponowne uruchomienie nic nie dubluje:
// status przechodzi ZAPLANOWANA → WYSYLANIE w jednym UPDATE, a odbiorcy wchodzą przez ON CONFLICT DO NOTHING.
export async function deliverMessage(base44, messageId, actor) {
  // Przejęcie wiadomości i domknięcie wysyłki to dwa wywołania bazy; p_promote podnosi też szkic
  // („Wyślij teraz"). Ponowne uruchomienie nic nie dubluje — status idzie tylko z ZAPLANOWANA.
  const m = await rpc(base44, "mb_admin_message_claim", { p_id: messageId, p_promote: true }).catch(() => null);
  if (!m || !m.id) return { ok: false, reason: "nie_przejeta" };
  const people = (await resolveRecipients(base44, m.target || {}).catch(() => [])) || [];
  const emails = [...new Set(people.map((p) => String(p.email || "").toLowerCase()).filter(Boolean))];

  // Odbiorcy, status i przydział dołączonego materiału — jedna transakcja w bazie.
  await rpc(base44, "mb_admin_message_finish", {
    p_id: m.id, p_emails: emails, p_actor: String(actor || "system").slice(0, 200),
  }).catch(() => 0);

  const mail = await sendMessageEmail(base44, m, emails).catch(() => ({ sent: 0 }));
  await libLog(base44, actor, "wiadomosc_wyslana", "message", m.id, `odbiorcy: ${emails.length} · e-maile: ${mail?.sent || 0}`);
  return { ok: true, id: m.id, odbiorcy: emails.length, maile: mail?.sent || 0, email_mode: m.email_mode || "BRAK" };
}

// Wpis do historii zmian — nigdy z treścią wiadomości, tokenem ani pełnym adresem.
export const libLog = (base44, actor, action, objectType, objectId, summary) => rpc(base44, "mb_log_add", {
  p_actor: String(actor || "system").slice(0, 200),
  p_action: String(action || "").slice(0, 60),
  p_object_type: objectType || null,
  p_object_id: objectId ? String(objectId) : null,
  p_summary: summary ? String(summary).slice(0, 500) : null,
});