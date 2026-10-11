// Wspólne budowanie widoku biblioteki i wiadomości — używane przez stronę klienta
// i przez „Podgląd oczami klienta" w panelu (żeby reguła i zakres pól były dokładnie te same).

import { runSql, escStr } from "./supabase.ts";
import { visibleMaterials, firstName } from "./libraryAccess.ts";
import { sanitizeHtml } from "./librarySanitize.ts";
import { embedUrl } from "./libraryMedia.ts";
import { renderBody } from "./libraryNotify.ts";

// Pola materiału widoczne dla klienta — bez file_key i bez prev_file_key.
export const MAT_COLS = `id, title, description, kind, duration_s, pages, stage, tags, external_url, video_provider, video_id,
  (file_key IS NOT NULL) AS has_file, allow_download, body_html, created_at`;

export function itemOf(m, vis, st) {
  const base = {
    id: m.id, title: m.title, kind: m.kind, description: m.description || null,
    duration_s: m.duration_s || null, pages: m.pages || null, stage: m.stage || null, tags: m.tags || [],
    note: vis.note || null, visible_from: vis.visible_from || null, visible_to: vis.visible_to || null,
    collection_id: vis.collection_id || null, position: vis.pos || 0,
    opened_at: st ? st.opened_at || null : null, completed_at: st ? st.completed_at || null : null,
    has_file: !!m.has_file, allow_download: !!m.allow_download,
  };
  if (m.kind === "WIDEO") base.embed = embedUrl(m.video_provider, m.video_id);
  if (m.kind === "LINK") base.url = m.external_url || null;
  if (m.kind === "TEKST") base.text = sanitizeHtml(m.body_html);
  return base;
}

export async function libraryData(base44, email, admin, preview) {
  const vis = (await visibleMaterials(base44, email, admin).catch(() => [])) || [];
  const ids = [...new Set(vis.map((r) => r.material_id).filter(Boolean))];
  if (!ids.length) return { items: [], collections: [], counts: { AUDIO: 0, WIDEO: 0, PDF: 0, LINK: 0, TEKST: 0 }, unopened: 0 };
  const inList = ids.map((i) => `${escStr(i)}::uuid`).join(",");
  const [mats, st] = await Promise.all([
    runSql(base44, `SELECT ${MAT_COLS} FROM public.mb_materials WHERE id IN (${inList}) AND deleted_at IS NULL`, true),
    preview ? Promise.resolve([]) : runSql(base44, `SELECT material_id, opened_at, completed_at FROM public.mb_material_state
      WHERE client_email = ${escStr(email)} AND material_id IN (${inList})`, true).catch(() => []),
  ]);
  const byId = new Map((mats || []).map((m) => [m.id, m]));
  const stById = new Map((st || []).map((s) => [s.material_id, s]));
  const items = [];
  for (const v of vis) {
    const m = byId.get(v.material_id);
    if (m) items.push(itemOf(m, v, stById.get(v.material_id)));
  }
  const counts = { AUDIO: 0, WIDEO: 0, PDF: 0, LINK: 0, TEKST: 0 };
  for (const i of items) if (counts[i.kind] !== undefined) counts[i.kind] += 1;
  const colIds = [...new Set(items.map((i) => i.collection_id).filter(Boolean))];
  const collections = colIds.length
    ? ((await runSql(base44, `SELECT id, title, description FROM public.mb_collections
        WHERE id IN (${colIds.map((c) => `${escStr(c)}::uuid`).join(",")}) AND deleted_at IS NULL`, true)) || [])
      .map((c) => ({ id: c.id, title: c.title, description: c.description || null,
        items: items.filter((i) => i.collection_id === c.id).sort((a, b) => a.position - b.position) }))
    : [];
  return { items, collections, counts, unopened: items.filter((i) => !i.opened_at).length };
}

export async function messagesData(base44, email, me, preview) {
  const rows = await runSql(base44, `SELECT m.id, m.title, m.body_html, m.sent_at, m.attached_material_id, m.attached_collection_id,
      r.read_at, r.delivered_at, mt.title AS material_title, mt.kind AS material_kind, cl.title AS collection_title
    FROM public.mb_message_recipients r JOIN public.mb_messages m ON m.id = r.message_id
    LEFT JOIN public.mb_materials mt ON mt.id = m.attached_material_id AND mt.deleted_at IS NULL
    LEFT JOIN public.mb_collections cl ON cl.id = m.attached_collection_id AND cl.deleted_at IS NULL
    WHERE r.client_email = ${escStr(email)} AND m.status = 'WYSLANA' AND r.hidden_at IS NULL
    ORDER BY m.sent_at DESC NULLS LAST LIMIT 100`, true).catch(() => []);
  const name = firstName(me);
  const items = (rows || []).map((m) => ({
    id: m.id, title: m.title || null, text: sanitizeHtml(renderBody(m.body_html, name)),
    sent_at: m.sent_at || null, read_at: m.read_at || null,
    material_id: m.attached_material_id || null, collection_id: m.attached_collection_id || null,
    material_title: m.material_title || null, material_kind: m.material_kind || null, collection_title: m.collection_title || null,
  }));
  return { items, unread: preview ? 0 : items.filter((m) => !m.read_at).length };
}