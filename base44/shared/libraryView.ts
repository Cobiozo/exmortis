// Wspólne budowanie widoku biblioteki i wiadomości — używane przez stronę klienta
// i przez „Podgląd oczami klienta" w panelu (żeby reguła i zakres pól były dokładnie te same).
//
// ETAP 2A: dane przychodzą jednym wywołaniem RPC (mb_client_library / mb_client_messages /
// mb_client_bundle), a nie z kilku zapytań Management API. Kształt odpowiedzi bez zmian.

import { rpc } from "./supabase.ts";
import { firstName } from "./libraryAccess.ts";
import { sanitizeHtml } from "./librarySanitize.ts";
import { embedUrl } from "./libraryMedia.ts";
import { renderBody } from "./libraryNotify.ts";

// Surowy wiersz materiału z bazy → kształt znany stronie klienta (bez klucza pliku).
export function itemOf(m) {
  const base = {
    id: m.id, title: m.title, kind: m.kind, description: m.description || null,
    duration_s: m.duration_s || null, pages: m.pages || null, stage: m.stage || null, tags: m.tags || [],
    note: m.note || null, visible_from: m.visible_from || null, visible_to: m.visible_to || null,
    collection_id: m.collection_id || null, position: m.position || 0,
    opened_at: m.opened_at || null, completed_at: m.completed_at || null,
    has_file: !!m.has_file, allow_download: !!m.allow_download,
  };
  if (m.kind === "WIDEO") base.embed = embedUrl(m.video_provider, m.video_id);
  if (m.kind === "LINK") base.url = m.external_url || null;
  if (m.kind === "TEKST") base.text = sanitizeHtml(m.body_html);
  return base;
}

const EMPTY_COUNTS = { AUDIO: 0, WIDEO: 0, PDF: 0, LINK: 0, TEKST: 0 };

// Odpowiedź RPC → gotowy widok biblioteki (kolekcje w kolejności, materiały poza kolekcjami).
export function libraryFromRpc(raw) {
  const items = (((raw || {}).items) || []).map(itemOf);
  const byId = new Map(items.map((i) => [i.id, i]));
  const collections = ((((raw || {}).collections) || [])).map((c) => ({
    id: c.id, title: c.title, description: c.description || null,
    items: ((c.items || []).map((x) => byId.get(x.id)).filter(Boolean)).sort((a, b) => a.position - b.position),
  }));
  return {
    items, collections,
    counts: Object.assign({ ...EMPTY_COUNTS }, (raw || {}).counts || {}),
    unopened: ((raw || {}).unopened) || 0,
  };
}

// Odpowiedź RPC → gotowy widok wiadomości ({imię} podstawione, treść oczyszczona).
export function messagesFromRpc(raw, me) {
  const name = firstName(me);
  const items = (((raw || {}).items) || []).map((m) => ({
    id: m.id, title: m.title || null, text: sanitizeHtml(renderBody(m.body_html, name)),
    sent_at: m.sent_at || null, read_at: m.read_at || null,
    material_id: m.material_id || null, collection_id: m.collection_id || null,
    material_title: m.material_title || null, material_kind: m.material_kind || null,
    collection_title: m.collection_title || null,
  }));
  return { items, unread: ((raw || {}).unread) || 0 };
}

export async function libraryData(base44, email, admin, preview) {
  const raw = await rpc(base44, "mb_client_library", { p_email: String(email || ""), p_admin: !!admin, p_preview: !!preview });
  return libraryFromRpc(raw);
}

export async function messagesData(base44, email, me, preview) {
  const raw = await rpc(base44, "mb_client_messages", { p_email: String(email || ""), p_preview: !!preview });
  return messagesFromRpc(raw, me);
}

// Jedno wejście dla /konto: przełączniki + biblioteka + wiadomości + nieprzeczytane.
export async function bundleData(base44, email, me, admin, preview) {
  const raw = await rpc(base44, "mb_client_bundle", { p_email: String(email || ""), p_admin: !!admin, p_preview: !!preview });
  const r = raw || {};
  return {
    library_mode: r.library_mode || "off",
    messages_mode: r.messages_mode || "off",
    whatsapp: r.whatsapp || null,
    library: r.library ? libraryFromRpc(r.library) : null,
    messages: r.messages ? messagesFromRpc(r.messages, me) : null,
  };
}