// E-maile biblioteki i wiadomości — przez istniejącą kolejkę (bez SMTP czekają, nic nie ginie).

import { runSql, rpc, escStr } from "./supabase.ts";
import { sendMail } from "./smtp.ts";
import { loadAppUrl } from "./settings.ts";
import { resolveRecipients, libSettings } from "./libraryAccess.ts";
import { sanitizeHtml } from "./librarySanitize.ts";

export const FOOTER_REPLY = "Na tę wiadomość odpowiesz e-mailem lub na WhatsAppie.";
export const FOOTER_CRISIS = "Jeśli jesteś w kryzysie: 116 123 · 800 70 2222 (całą dobę, bezpłatnie) · 112.";

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
  let sent = 0;
  for (const to of emails.slice(0, 500)) {
    const r = await sendMail(base44, {
      to, subject: message.email_mode === "PELNA" ? title : "Masz nową wiadomość na exmortis.pl",
      html, kind: "biblioteka_wiadomosc", ref: String(message.id || ""),
    }).catch(() => null);
    if (r) sent++;
  }
  return { sent };
}

// Zbiorczy e-mail o nowych materiałach — jeden na osobę, bez tytułów i bez treści materiałów.
export async function sendAssignmentDigests(base44) {
  const s = await libSettings(base44, true);
  if (!s.email_notify) return { wyslane: 0, pominiete: true };
  const rows = await runSql(base44, `SELECT id, material_id, collection_id, target_kind, target_email, group_id, group_mode,
      snapshot_emails, exceptions_add, exceptions_drop
    FROM public.mb_assignments
    WHERE notified_at IS NULL AND revoked_at IS NULL AND created_at > now() - interval '2 days'
      AND (visible_from IS NULL OR visible_from <= now())
      AND (visible_to IS NULL OR visible_to > now())
    ORDER BY created_at LIMIT 200`, true);
  if (!rows || !rows.length) return { wyslane: 0, przydzialy: 0 };

  const perPerson = new Map();
  const ids = [];
  for (const a of rows) {
    ids.push(a.id);
    const target = a.target_kind === "osoba"
      ? { kind: "osoba", emails: [a.target_email] }
      : { kind: "grupa", group_id: a.group_id, group_mode: a.group_mode, snapshot_emails: a.snapshot_emails || [], exceptions_add: a.exceptions_add || [], exceptions_drop: a.exceptions_drop || [] };
    const people = await resolveRecipients(base44, target).catch(() => []);
    for (const p of people || []) {
      const e = String(p.email || "").toLowerCase();
      if (e) perPerson.set(e, (perPerson.get(e) || 0) + 1);
    }
  }
  const appUrl = await loadAppUrl(base44);
  let sent = 0;
  for (const [email, count] of perPerson) {
    const html = wrap("Masz nowe materiały w bibliotece",
      `<p style="font-size:15px;line-height:1.7">W Twojej bibliotece ${count === 1 ? "pojawił się nowy materiał" : `pojawiły się nowe materiały (${count})`}.</p>`,
      appUrl);
    const r = await sendMail(base44, { to: email, subject: "Nowe materiały w Twojej bibliotece", html, kind: "biblioteka_material" }).catch(() => null);
    if (r) sent++;
  }
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

  await sendMessageEmail(base44, m, emails).catch(() => {});
  await libLog(base44, actor, "wiadomosc_wyslana", "message", m.id, `odbiorcy: ${emails.length}`);
  return { ok: true, id: m.id, odbiorcy: emails.length };
}

// Wpis do historii zmian — nigdy z treścią wiadomości, tokenem ani pełnym adresem.
export const libLog = (base44, actor, action, objectType, objectId, summary) => rpc(base44, "mb_log_add", {
  p_actor: String(actor || "system").slice(0, 200),
  p_action: String(action || "").slice(0, 60),
  p_object_type: objectType || null,
  p_object_id: objectId ? String(objectId) : null,
  p_summary: summary ? String(summary).slice(0, 500) : null,
});