import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { runSql, escStr, requireAdmin, textField } from "../../shared/supabase.ts";
import { SCHEMA_SQL, SEED_SQL, CHECKPOINT_TABLES_SQL, CHECKPOINT_FUNCS_SQL } from "../../shared/librarySchema.ts";
import { libSettings, resetLibSettings, MODES, resolveRecipients, randomToken } from "../../shared/libraryAccess.ts";
import { sanitizeHtml, plainText } from "../../shared/librarySanitize.ts";
import { normalizeVideo, extOf, sniff, pdfHasJs, MAX_BYTES, ALLOWED_EXT, MAX_MB, SNIFF_BYTES, mb } from "../../shared/libraryMedia.ts";
import { libLog, deliverMessage, sendMessageEmail } from "../../shared/libraryNotify.ts";
import { libraryData, messagesData } from "../../shared/libraryView.ts";

// Panel biblioteki i wiadomości. Wyłącznie rola „admin" (konto techniczne nie ma dostępu),
// wszystko sprawdzane na serwerze, nieznana akcja = 404.

const NOT_FOUND = () => Response.json({ error: "Nie znaleziono" }, { status: 404 });
const bad = (m, s = 400) => Response.json({ error: m }, { status: s });
const int = (v, min, max, def = null) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && v !== "" && v !== null && v !== undefined ? Math.min(max, Math.max(min, n)) : def;
};
const uuidOrNull = (v) => (/^[0-9a-fA-F-]{36}$/.test(String(v || "").trim()) ? String(v).trim() : null);
const iso = (v) => { if (!v) return null; const d = new Date(v); if (isNaN(d.getTime())) throw new Error("Niepoprawna data"); return d.toISOString(); };
const emailsOf = (v, max = 2000) => [...new Set((Array.isArray(v) ? v : []).map((x) => String(x || "").trim().toLowerCase()).filter((x) => x.includes("@") && x.length <= 320))].slice(0, max);
const lower = (v) => String(v || "").trim().toLowerCase();

// ---- pomocnicze ----

async function spaceUsed(base44) {
  const r = await runSql(base44, `SELECT COALESCE(sum(COALESCE(file_size,0) + COALESCE(prev_file_size,0)),0)::bigint AS bytes,
    count(*)::int AS pliki FROM public.mb_materials WHERE deleted_at IS NULL AND file_key IS NOT NULL`, true).catch(() => []);
  const row = (r && r[0]) || {};
  return { bytes: Number(row.bytes || 0), files: Number(row.pliki || 0) };
}

// Grupa automatyczna: tylko odczyt z istniejących danych (zakupy, pakiety). Logika zakupów i rezerwacji nietknięta.
async function autoEmails(base44, g) {
  const r = (g && g.rule) || {};
  if (r.typ === "produkt" && r.id) {
    const rows = await runSql(base44, `SELECT DISTINCT lower(btrim(o.buyer_email)) AS email
      FROM public.orders o, jsonb_array_elements(o.items) e
      WHERE o.status = 'COMPLETED' AND e->>'product_id' = ${escStr(String(r.id))} AND o.buyer_email IS NOT NULL`, true).catch(() => []);
    return (rows || []).map((x) => lower(x.email)).filter(Boolean);
  }
  if (r.typ === "aktywny_pakiet") {
    const rows = await runSql(base44, `SELECT DISTINCT lower(btrim(p.email_display)) AS email FROM public.bk_packages p
      WHERE p.payment_status = 'oplacony' AND p.valid_until > now() AND p.sessions_used < p.sessions_total
        AND p.email_display IS NOT NULL`, true).catch(() => []);
    return (rows || []).map((x) => lower(x.email)).filter(Boolean);
  }
  return [];
}

// Sprawdzenie wgranego pliku: rozszerzenie, sygnatura, rozmiar; dla PDF dodatkowo aktywna zawartość (ostrzeżenie).
async function verifyUpload(base44, kind, fileUri, fileName, declaredSize) {
  const allowed = ALLOWED_EXT[kind];
  if (!allowed) throw new Error("Ten rodzaj materiału nie przyjmuje pliku.");
  const ext = extOf(fileName);
  if (!allowed.includes(ext)) throw new Error(`Dozwolone rozszerzenia: ${allowed.map((x) => "." + x).join(", ")}.`);
  if (String(fileUri).includes("@")) throw new Error("Klucz pliku nie może zawierać adresu e-mail.");
  const signed = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: fileUri, expires_in: 60 });
  if (!signed || !signed.signed_url) throw new Error("Nie udało się odczytać wgranego pliku.");
  const res = await fetch(signed.signed_url, {
    headers: { Range: `bytes=0-${SNIFF_BYTES - 1}` }, signal: AbortSignal.timeout(25000),
  }).catch(() => null);
  if (!res || (!res.ok && res.status !== 206)) throw new Error("Nie udało się odczytać wgranego pliku.");
  const buf = new Uint8Array(await res.arrayBuffer());
  let size = Number(declaredSize) || 0;
  const cr = res.headers.get("content-range") || "";
  const m = /\/(\d+)\s*$/.exec(cr);
  if (m) size = Number(m[1]);
  else if (res.status === 200) size = buf.length;
  if (size > MAX_BYTES[kind]) throw new Error(`Plik jest za duży: ${mb(size)} MB, a limit to ${MAX_MB[kind]} MB.`);
  if (!sniff(kind, buf)) throw new Error("Sygnatura pliku nie zgadza się z rozszerzeniem — plik odrzucony.");
  return { size, pdfJs: kind === "PDF" ? pdfHasJs(buf) : false };
}

function cleanTarget(body) {
  const kind = body && body.kind === "grupa" ? "grupa" : "osoba";
  const t = { kind };
  if (kind === "osoba") {
    t.emails = emailsOf(body.emails);
    if (!t.emails.length) throw new Error("Wybierz osobę.");
  } else {
    t.group_id = uuidOrNull(body.group_id);
    if (!t.group_id) throw new Error("Wybierz grupę.");
    t.group_mode = body.group_mode === "TYLKO_OBECNI" ? "TYLKO_OBECNI" : "OBECNI_I_PRZYSZLI";
    t.snapshot_emails = t.group_mode === "TYLKO_OBECNI" ? emailsOf(body.snapshot_emails) : [];
    t.exceptions_add = emailsOf(body.exceptions_add);
    t.exceptions_drop = emailsOf(body.exceptions_drop);
  }
  return t;
}

async function namesOf(base44, emails) {
  const list = (emails || []).slice(0, 2000);
  if (!list.length) return {};
  const users = await base44.asServiceRole.entities.User.list("-created_date", 2000).catch(() => []);
  const out = {};
  for (const u of users || []) {
    const e = lower(u.email);
    if (list.includes(e)) out[e] = String(u.imie || u.full_name || "").trim();
  }
  return out;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await requireAdmin(base44).catch(() => null);
    if (!me) return Response.json({ error: "Brak dostępu" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const a = body.action;
    const sr = base44.asServiceRole.entities;

    // ---- migracja i kontrola ----
    if (a === "migrate") {
      await runSql(base44, SCHEMA_SQL);
      await runSql(base44, SEED_SQL);
      const t = await runSql(base44, `SELECT tick_token FROM public.mb_settings WHERE id = 1`, true);
      if (!t || !t[0] || !t[0].tick_token) {
        await runSql(base44, `UPDATE public.mb_settings SET tick_token = ${escStr(randomToken())} WHERE id = 1`);
      }
      await libLog(base44, me.email, "migracja", "baza", "mb", "tabele mb_* i reguły dostępu");
      resetLibSettings();
      return Response.json({ ok: true });
    }

    if (a === "checkpoint") {
      const [tables, funcs] = await Promise.all([
        runSql(base44, CHECKPOINT_TABLES_SQL, true),
        runSql(base44, CHECKPOINT_FUNCS_SQL, true),
      ]);
      const space = await spaceUsed(base44);
      return Response.json({ tabele: tables || [], funkcje: funcs || [], przestrzen: space });
    }

    // ---- ustawienia ----
    if (a === "settings") {
      const s = await libSettings(base44, true);
      const space = await spaceUsed(base44);
      const limitBytes = Number(s.space_limit_mb || 5120) * 1048576;
      return Response.json({ settings: s, przestrzen: { ...space, limit_mb: s.space_limit_mb, procent: Math.round((space.bytes / limitBytes) * 100) } });
    }

    if (a === "save_settings") {
      const lib = MODES.includes(body.library_mode) ? body.library_mode : "off";
      const msg = MODES.includes(body.messages_mode) ? body.messages_mode : "off";
      const wa = String(body.whatsapp || "").trim();
      if (wa && !/^https:\/\/wa\.me\/[0-9]{6,20}$/.test(wa)) throw new Error("Adres WhatsApp: wyłącznie format https://wa.me/cyfry");
      const limit = int(body.space_limit_mb, 64, 1048576, 5120);
      await runSql(base44, `UPDATE public.mb_settings SET library_mode = ${escStr(lib)}, messages_mode = ${escStr(msg)},
        email_notify = ${body.email_notify === true ? "TRUE" : "FALSE"}, whatsapp = ${wa ? escStr(wa) : "NULL"},
        space_limit_mb = ${limit}, updated_at = now() WHERE id = 1`);
      await libLog(base44, me.email, "ustawienia", "settings", "1", `biblioteka=${lib} wiadomosci=${msg} mail=${body.email_notify === true ? "wl" : "wyl"}`);
      resetLibSettings();
      return Response.json({ ok: true });
    }

    // Token zadania — pokazywany administratorowi raz do wklejenia w automatyzacji.
    if (a === "tick_token") {
      const t = await runSql(base44, `SELECT tick_token FROM public.mb_settings WHERE id = 1`, true);
      let token = t && t[0] ? t[0].tick_token : null;
      if (body.rotate === true || !token) {
        token = randomToken();
        await runSql(base44, `UPDATE public.mb_settings SET tick_token = ${escStr(token)} WHERE id = 1`);
        await libLog(base44, me.email, "token_zadania", "settings", "1", body.rotate === true ? "obrot" : "utworzenie");
      }
      return Response.json({ token, fresh: body.rotate === true || !t || !t[0] || !t[0].tick_token });
    }

    // ---- materiały ----
    if (a === "materials_list") {
      const rows = await runSql(base44, `SELECT m.id, m.title, m.kind, m.description, m.stage, m.tags, m.file_version,
          m.file_size, m.prev_file_size, m.pdf_js_warning, m.external_url, m.video_provider, m.video_id, m.duration_s, m.pages,
          m.allow_download, m.body_html, m.created_at, m.source,
          (SELECT count(*)::int FROM public.mb_assignments x WHERE x.revoked_at IS NULL
             AND (x.material_id = m.id OR x.collection_id IN (SELECT ci.collection_id FROM public.mb_collection_items ci WHERE ci.material_id = m.id))) AS przydzialy,
          (SELECT count(*)::int FROM public.mb_material_state s WHERE s.material_id = m.id AND s.opened_at IS NOT NULL) AS otwarte,
          (SELECT count(*)::int FROM public.mb_material_state s WHERE s.material_id = m.id AND s.completed_at IS NOT NULL) AS ukonczone
        FROM public.mb_materials m WHERE m.deleted_at IS NULL ORDER BY m.created_at DESC LIMIT 500`, true);
      const space = await spaceUsed(base44);
      const s = await libSettings(base44);
      return Response.json({ items: (rows || []).map((r) => ({ ...r, preview: plainText(r.body_html) })), przestrzen: { ...space, limit_mb: s.space_limit_mb } });
    }

    // Rejestracja pliku wgranego z przeglądarki — dopiero po sprawdzeniu sygnatury i rozmiaru.
    if (a === "material_register") {
      const kind = body.kind === "AUDIO" ? "AUDIO" : body.kind === "PDF" ? "PDF" : null;
      if (!kind) return bad("Wybierz rodzaj pliku.");
      const fileUri = textField(body, "file_uri", { max: 500 });
      const fileName = textField(body, "file_name", { max: 300 });
      const title = String(body.title || fileName.replace(/\.[a-z0-9]{1,8}$/i, "")).trim().slice(0, 200);
      if (!title) return bad("Wpisz tytuł materiału.");
      const v = await verifyUpload(base44, kind, fileUri, fileName, body.file_size).catch((e) => ({ err: e.message }));
      if (v.err) {
        await libLog(base44, me.email, "plik_odrzucony", "material", null, `${kind}: ${v.err}`);
        return bad(v.err);
      }
      const id = (await runSql(base44, `INSERT INTO public.mb_materials (kind, title, file_key, file_name, file_size, pdf_js_warning, created_by)
        VALUES (${escStr(kind)}, ${escStr(title)}, ${escStr(fileUri)}, ${escStr(fileName)}, ${v.size}, ${v.pdfJs ? "TRUE" : "FALSE"}, ${escStr(me.email)}) RETURNING id`))[0].id;
      await libLog(base44, me.email, "plik_wgrany", "material", id, `${kind} ${mb(v.size)} MB${v.pdfJs ? " · ostrzezenie: PDF z aktywna trescia" : ""}`);
      return Response.json({ ok: true, id, file_size: v.size, pdf_js_warning: v.pdfJs });
    }

    if (a === "material_save") {
      const id = uuidOrNull(body.id);
      const kind = ["AUDIO", "WIDEO", "PDF", "LINK", "TEKST"].includes(body.kind) ? body.kind : null;
      if (!kind) return bad("Nieznany rodzaj materiału.");
      const title = textField(body, "title", { max: 200 });
      const desc = body.description ? String(body.description).trim().slice(0, 2000) : null;
      const stage = body.stage ? String(body.stage).trim().slice(0, 60) : null;
      const tags = (Array.isArray(body.tags) ? body.tags : []).map((t) => String(t).trim().slice(0, 40)).filter(Boolean).slice(0, 20);
      const allowDownload = body.allow_download === true;
      let cols = {};

      if (kind === "LINK") {
        const url = String(body.external_url || "").trim();
        if (!/^https:\/\/\S+$/.test(url)) return bad("Adres musi zaczynać się od https://");
        cols = { external_url: escStr(url), video_provider: "NULL", video_id: "NULL", body_html: "NULL", file_key: "NULL", file_name: "NULL", file_size: "NULL" };
      } else if (kind === "WIDEO") {
        const v = normalizeVideo(body.external_url);
        if (!v) return bad("Dozwolone są tylko filmy z YouTube, Vimeo i Bunny — wklej poprawny adres https.");
        cols = { video_provider: escStr(v.provider), video_id: escStr(v.id), external_url: "NULL", body_html: "NULL", file_key: "NULL", file_name: "NULL", file_size: "NULL" };
      } else if (kind === "TEKST") {
        const html = sanitizeHtml(body.body_html);
        if (!html) return bad("Wpisz treść materiału.");
        cols = { body_html: escStr(html), external_url: "NULL", video_provider: "NULL", video_id: "NULL", file_key: "NULL", file_name: "NULL", file_size: "NULL" };
      } else {
        if (!id) return bad("Najpierw wgraj plik (PDF albo audio).");
        cols = { external_url: "NULL", video_provider: "NULL", video_id: "NULL", body_html: "NULL" };
      }

      const meta = `title = ${escStr(title)}, description = ${esc(desc)}, stage = ${esc(stage)},
        tags = ${tags.length ? `ARRAY[${tags.map(escStr).join(",")}]::text[]` : `'{}'::text[]`},
        duration_s = ${esc(int(body.duration_s, 0, 100000, null))}, pages = ${esc(int(body.pages, 0, 100000, null))},
        allow_download = ${allowDownload ? "TRUE" : "FALSE"}, source = ${esc(body.source ? String(body.source).slice(0, 200) : null)}, updated_at = now()`;
      const setCols = Object.entries(cols).map(([k, v]) => `${k} = ${v}`).join(", ");

      if (id) {
        const r = await runSql(base44, `UPDATE public.mb_materials SET kind = ${escStr(kind)}, ${meta}, ${setCols}
          WHERE id = ${escStr(id)}::uuid AND deleted_at IS NULL RETURNING id`);
        if (!r || !r.length) return NOT_FOUND();
        await libLog(base44, me.email, "material_zmiana", "material", id, title);
        return Response.json({ ok: true, id });
      }
      const created = await runSql(base44, `INSERT INTO public.mb_materials (kind, title, description, stage, tags, duration_s, pages, allow_download, source, created_by, ${Object.keys(cols).join(", ")})
        VALUES (${escStr(kind)}, ${escStr(title)}, ${esc(desc)}, ${esc(stage)}, ${tags.length ? `ARRAY[${tags.map(escStr).join(",")}]::text[]` : `'{}'::text[]`},
          ${esc(int(body.duration_s, 0, 100000, null))}, ${esc(int(body.pages, 0, 100000, null))}, ${allowDownload ? "TRUE" : "FALSE"},
          ${esc(body.source ? String(body.source).slice(0, 200) : null)}, ${escStr(me.email)}, ${Object.values(cols).join(", ")}) RETURNING id`);
      const newId = created[0].id;
      await libLog(base44, me.email, "material_dodany", "material", newId, `${kind} ${title}`);
      return Response.json({ ok: true, id: newId });
    }

    // Zamiana pliku: nowa wersja, jedna poprzednia do cofnięcia, przydziały bez zmian.
    if (a === "material_replace") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const [m] = await runSql(base44, `SELECT id, kind, title FROM public.mb_materials WHERE id = ${escStr(id)}::uuid AND deleted_at IS NULL`, true);
      if (!m) return NOT_FOUND();
      if (m.kind !== "PDF" && m.kind !== "AUDIO") return bad("Plik można zamienić tylko w materiale PDF albo audio.");
      const fileUri = textField(body, "file_uri", { max: 500 });
      const fileName = textField(body, "file_name", { max: 300 });
      const v = await verifyUpload(base44, m.kind, fileUri, fileName, body.file_size).catch((e) => ({ err: e.message }));
      if (v.err) {
        await libLog(base44, me.email, "plik_odrzucony", "material", id, `${m.kind}: ${v.err}`);
        return bad(v.err);
      }
      await runSql(base44, `UPDATE public.mb_materials SET
        prev_file_key = file_key, prev_file_name = file_name, prev_file_size = file_size,
        file_key = ${escStr(fileUri)}, file_name = ${escStr(fileName)}, file_size = ${v.size},
        file_version = file_version + 1, pdf_js_warning = ${v.pdfJs ? "TRUE" : "FALSE"}, updated_at = now()
        WHERE id = ${escStr(id)}::uuid`);
      await libLog(base44, me.email, "plik_zamieniony", "material", id, `${m.kind} ${mb(v.size)} MB`);
      return Response.json({ ok: true, id, file_size: v.size, pdf_js_warning: v.pdfJs });
    }

    if (a === "material_delete") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const r = await runSql(base44, `UPDATE public.mb_materials SET deleted_at = now(), updated_at = now()
        WHERE id = ${escStr(id)}::uuid AND deleted_at IS NULL RETURNING title`);
      if (!r || !r.length) return NOT_FOUND();
      await runSql(base44, `UPDATE public.mb_assignments SET revoked_at = now() WHERE material_id = ${escStr(id)}::uuid AND revoked_at IS NULL`);
      await libLog(base44, me.email, "material_usuniety", "material", id, r[0].title);
      return Response.json({ ok: true });
    }

    // ---- kolekcje ----
    if (a === "collections_list") {
      const rows = await runSql(base44, `SELECT c.id, c.title, c.description, c.sort, c.created_at,
          COALESCE(json_agg(json_build_object('material_id', ci.material_id, 'position', ci.position, 'title', m.title, 'kind', m.kind)
            ORDER BY ci.position) FILTER (WHERE ci.material_id IS NOT NULL), '[]') AS items
        FROM public.mb_collections c
        LEFT JOIN public.mb_collection_items ci ON ci.collection_id = c.id
        LEFT JOIN public.mb_materials m ON m.id = ci.material_id AND m.deleted_at IS NULL
        WHERE c.deleted_at IS NULL GROUP BY c.id ORDER BY c.sort, c.created_at`, true);
      return Response.json({ items: rows || [] });
    }

    if (a === "collection_save") {
      const id = uuidOrNull(body.id);
      const title = textField(body, "title", { max: 200 });
      const desc = body.description ? String(body.description).trim().slice(0, 2000) : null;
      const items = Array.isArray(body.items) ? body.items.map((x) => ({ id: uuidOrNull(x && x.material_id), position: int(x && x.position, 0, 10000, 0) })).filter((x) => x.id) : [];
      let colId = id;
      if (colId) {
        const r = await runSql(base44, `UPDATE public.mb_collections SET title = ${escStr(title)}, description = ${esc(desc)}, updated_at = now()
          WHERE id = ${escStr(colId)}::uuid AND deleted_at IS NULL RETURNING id`);
        if (!r || !r.length) return NOT_FOUND();
      } else {
        const r = await runSql(base44, `INSERT INTO public.mb_collections (title, description, sort, created_by)
          VALUES (${escStr(title)}, ${esc(desc)}, ${int(body.sort, 0, 10000, 0)}, ${escStr(me.email)}) RETURNING id`);
        colId = r[0].id;
      }
      await runSql(base44, `DELETE FROM public.mb_collection_items WHERE collection_id = ${escStr(colId)}::uuid`);
      if (items.length) {
        await runSql(base44, `INSERT INTO public.mb_collection_items (collection_id, material_id, position) VALUES
          ${items.map((x, i) => `(${escStr(colId)}::uuid, ${escStr(x.id)}::uuid, ${x.position || i})`).join(", ")}`);
      }
      await libLog(base44, me.email, id ? "kolekcja_zmiana" : "kolekcja_dodana", "collection", colId, `${title} (${items.length})`);
      return Response.json({ ok: true, id: colId });
    }

    if (a === "collection_delete") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const r = await runSql(base44, `UPDATE public.mb_collections SET deleted_at = now() WHERE id = ${escStr(id)}::uuid AND deleted_at IS NULL RETURNING title`);
      if (!r || !r.length) return NOT_FOUND();
      await runSql(base44, `UPDATE public.mb_assignments SET revoked_at = now() WHERE collection_id = ${escStr(id)}::uuid AND revoked_at IS NULL`);
      await libLog(base44, me.email, "kolekcja_usunieta", "collection", id, r[0].title);
      return Response.json({ ok: true });
    }

    // ---- grupy ----
    if (a === "groups_list") {
      const groups = await runSql(base44, `SELECT id, name, color, description, kind, rule, created_at FROM public.mb_groups ORDER BY kind, name`, true);
      const members = await runSql(base44, `SELECT group_id, client_email FROM public.mb_group_members`, true);
      const out = [];
      for (const g of groups || []) {
        const manual = (members || []).filter((m) => m.group_id === g.id).map((m) => lower(m.client_email));
        const auto = g.kind === "AUTOMATYCZNA" ? await autoEmails(base44, g) : [];
        out.push({ ...g, members: g.kind === "AUTOMATYCZNA" ? auto : manual, count: g.kind === "AUTOMATYCZNA" ? auto.length : manual.length });
      }
      return Response.json({ items: out });
    }

    if (a === "group_save") {
      const id = uuidOrNull(body.id);
      const name = textField(body, "name", { max: 120 });
      const color = body.color ? String(body.color).trim() : null;
      if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) return bad("Kolor w formacie #RRGGBB.");
      const desc = body.description ? String(body.description).trim().slice(0, 1000) : null;
      const kind = body.kind === "AUTOMATYCZNA" ? "AUTOMATYCZNA" : "RECZNA";
      let rule = null;
      if (kind === "AUTOMATYCZNA") {
        const typ = body.rule && body.rule.typ === "aktywny_pakiet" ? "aktywny_pakiet" : "produkt";
        if (typ === "produkt" && !uuidOrNull(body.rule && body.rule.id)) return bad("Wybierz produkt.");
        rule = typ === "produkt" ? { typ, id: uuidOrNull(body.rule.id) } : { typ };
      }
      if (id) {
        const r = await runSql(base44, `UPDATE public.mb_groups SET name = ${escStr(name)}, color = ${esc(color)},
          description = ${esc(desc)}, kind = ${escStr(kind)}, rule = ${rule ? escStr(JSON.stringify(rule)) + "::jsonb" : "NULL"}, updated_at = now()
          WHERE id = ${escStr(id)}::uuid RETURNING id`);
        if (!r || !r.length) return NOT_FOUND();
        await libLog(base44, me.email, "grupa_zmiana", "group", id, name);
        return Response.json({ ok: true, id });
      }
      const created = await runSql(base44, `INSERT INTO public.mb_groups (name, color, description, kind, rule, created_by)
        VALUES (${escStr(name)}, ${esc(color)}, ${esc(desc)}, ${escStr(kind)}, ${rule ? escStr(JSON.stringify(rule)) + "::jsonb" : "NULL"}, ${escStr(me.email)}) RETURNING id`);
      await libLog(base44, me.email, "grupa_dodana", "group", created[0].id, name);
      return Response.json({ ok: true, id: created[0].id });
    }

    // Usunięcie grupy: pytamy, co z materiałami członków — odebranie albo zostawienie indywidualnie.
    if (a === "group_delete") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const take = body.materials === "odbierz";
      const [g] = await runSql(base44, `SELECT id, name, kind FROM public.mb_groups WHERE id = ${escStr(id)}::uuid`, true);
      if (!g) return NOT_FOUND();
      if (g.kind === "AUTOMATYCZNA") return bad("Grupy automatycznej nie można usunąć — usuń jej regułę w kodzie produktu.");
      const members = await runSql(base44, `SELECT client_email FROM public.mb_group_members WHERE group_id = ${escStr(id)}::uuid`, true);
      let assigned = 0;
      if (take) {
        const r = await runSql(base44, `UPDATE public.mb_assignments SET revoked_at = now()
          WHERE group_id = ${escStr(id)}::uuid AND revoked_at IS NULL RETURNING 1`);
        assigned = (r || []).length;
      } else {
        // Zostawiamy indywidualnie: grupa znika, ale członkowie dostają przydziały wprost.
        const rows = await runSql(base44, `SELECT id, target_kind, group_mode, snapshot_emails, exceptions_add, exceptions_drop FROM public.mb_assignments
          WHERE group_id = ${escStr(id)}::uuid AND revoked_at IS NULL`, true);
        for (const a2 of rows || []) {
          const list = a2.group_mode === "TYLKO_OBECNI"
            ? emailsOf(a2.snapshot_emails).filter((e) => !emailsOf(a2.exceptions_drop).includes(e)).concat(emailsOf(a2.exceptions_add))
            : (members || []).map((m) => lower(m.client_email)).filter((e) => !emailsOf(a2.exceptions_drop).includes(e)).concat(emailsOf(a2.exceptions_add));
          for (const e of [...new Set(list)]) {
            await runSql(base44, `INSERT INTO public.mb_assignments (material_id, collection_id, target_kind, target_email, note, visible_from, visible_to, created_by)
              SELECT material_id, collection_id, 'osoba', ${escStr(e)}, note, visible_from, visible_to, ${escStr(me.email)}
              FROM public.mb_assignments WHERE id = ${escStr(a2.id)}::uuid`);
          }
          await runSql(base44, `UPDATE public.mb_assignments SET revoked_at = now() WHERE id = ${escStr(a2.id)}::uuid`);
        }
        assigned = (rows || []).length;
      }
      await runSql(base44, `DELETE FROM public.mb_groups WHERE id = ${escStr(id)}::uuid`);
      await libLog(base44, me.email, "grupa_usunieta", "group", id, `${g.name} · materialy: ${take ? "odebrane" : "zostawione indywidualnie"} (${assigned})`);
      return Response.json({ ok: true, materials: take ? "odebrane" : "zostawione", przydzialy: assigned });
    }

    if (a === "group_members_add" || a === "group_members_remove") {
      const id = uuidOrNull(body.group_id);
      if (!id) return NOT_FOUND();
      const [g] = await runSql(base44, `SELECT kind, name FROM public.mb_groups WHERE id = ${escStr(id)}::uuid`, true);
      if (!g) return NOT_FOUND();
      if (g.kind === "AUTOMATYCZNA") return bad("Ta grupa jest automatyczna — członków wyznaczają zakupy i pakiety.");
      const list = emailsOf(body.emails);
      if (!list.length) return bad("Wybierz osoby.");
      if (a === "group_members_add") {
        await runSql(base44, `INSERT INTO public.mb_group_members (group_id, client_email, added_by)
          SELECT ${escStr(id)}::uuid, e, ${escStr(me.email)} FROM unnest(ARRAY[${list.map(escStr).join(",")}]::text[]) AS e
          ON CONFLICT (group_id, client_email) DO NOTHING`);
      } else {
        await runSql(base44, `DELETE FROM public.mb_group_members WHERE group_id = ${escStr(id)}::uuid AND client_email IN (${list.map(escStr).join(",")})`);
      }
      await libLog(base44, me.email, a === "group_members_add" ? "grupa_dodanie" : "grupa_usuniecie", "group", id, `${g.name} · ${list.length}`);
      return Response.json({ ok: true, count: list.length });
    }

    // ---- klienci ----
    if (a === "clients_list") {
      const users = await sr.User.list("-created_date", 2000).catch(() => []);
      const members = await runSql(base44, `SELECT group_id, client_email FROM public.mb_group_members`, true);
      const groups = (await runSql(base44, `SELECT id, name, color, kind, rule FROM public.mb_groups ORDER BY name`, true)) || [];
      const autoByGroup = new Map();
      for (const g of groups.filter((x) => x.kind === "AUTOMATYCZNA")) autoByGroup.set(g.id, new Set(await autoEmails(base44, g)));
      const pkg = new Set(((await runSql(base44, `SELECT DISTINCT lower(btrim(email_display)) AS email FROM public.bk_packages
        WHERE payment_status = 'oplacony' AND valid_until > now() AND sessions_used < sessions_total AND email_display IS NOT NULL`, true).catch(() => [])) || []).map((x) => lower(x.email)));
      const rows = [];
      for (const u of users || []) {
        const e = lower(u.email);
        if (!e || u.role === "zablokowane") continue;
        const mine = [];
        for (const m of members || []) if (m.group_id && lower(m.client_email) === e) mine.push(m.group_id);
        for (const [gid, set] of autoByGroup) if (set.has(e)) mine.push(gid);
        rows.push({
          email: e, name: String(u.imie || u.full_name || "").trim(), joined: u.created_date || null,
          groups: groups.filter((g) => mine.includes(g.id)).map((g) => ({ id: g.id, name: g.name, color: g.color || null, kind: g.kind })),
          package: pkg.has(e), blocked: u.role === "zablokowane",
        });
      }
      const q = lower(body.q);
      const gid = uuidOrNull(body.group_id);
      const mode = body.group_mode === "any" ? "any" : "all";
      let out = rows;
      if (q) out = out.filter((r) => r.email.includes(q) || lower(r.name).includes(q));
      if (gid) out = out.filter((r) => (mode === "any" ? r.groups.some((g) => g.id === gid) : r.groups.every((g) => g.id === gid) && r.groups.some((g) => g.id === gid)));
      if (body.no_group === true) out = out.filter((r) => !r.groups.length);
      if (body.has_package === true) out = out.filter((r) => r.package);
      return Response.json({ items: out, total: out.length, grupy: groups });
    }

    if (a === "client_detail") {
      const email = lower(body.email);
      if (!email.includes("@")) return bad("Podaj e-mail.");
      const users = await sr.User.filter({ email }).catch(() => []);
      const u = (users || [])[0] || null;
      const [lib, msgs] = await Promise.all([
        libraryData(base44, email, true, true),
        messagesData(base44, email, u || { email }, true),
      ]);
      const groups = (await runSql(base44, `SELECT g.id, g.name, g.color, g.kind FROM public.mb_groups g
        WHERE (g.kind = 'RECZNA' AND EXISTS (SELECT 1 FROM public.mb_group_members m WHERE m.group_id = g.id AND m.client_email = ${escStr(email)}))
           OR g.kind = 'AUTOMATYCZNA' ORDER BY g.name`, true)) || [];
      const withAuto = [];
      for (const g of groups) {
        if (g.kind !== "AUTOMATYCZNA") { withAuto.push(g); continue; }
        const list = await autoEmails(base44, (await runSql(base44, `SELECT rule FROM public.mb_groups WHERE id = ${escStr(g.id)}::uuid`, true))[0]);
        if (list.includes(email)) withAuto.push(g);
      }
      const pkgs = (await runSql(base44, `SELECT id, sessions_total, sessions_used, valid_until, payment_status, source, created_at
        FROM public.bk_packages WHERE lower(btrim(email_display)) = ${escStr(email)} ORDER BY created_at DESC LIMIT 20`, true).catch(() => [])) || [];
      const sends = (await runSql(base44, `SELECT m.id, m.title, m.sent_at, r.read_at, r.hidden_at
        FROM public.mb_message_recipients r JOIN public.mb_messages m ON m.id = r.message_id
        WHERE r.client_email = ${escStr(email)} ORDER BY m.sent_at DESC NULLS LAST LIMIT 50`, true).catch(() => [])) || [];
      return Response.json({
        client: { email, name: u ? String(u.imie || u.full_name || "").trim() : "", joined: u ? u.created_date : null, role: u ? u.role : null },
        groups: withAuto, materials: lib.items, messages: msgs.items, sends, packages: pkgs,
      });
    }

    // ---- przydziały ----
    if (a === "assignment_preview") {
      const t = cleanTarget(body.target || {});
      const people = (await resolveRecipients(base44, t).catch(() => [])) || [];
      const emails = [...new Set(people.map((p) => lower(p.email)).filter(Boolean))];
      const names = await namesOf(base44, emails);
      return Response.json({ count: emails.length, emails, names });
    }

    if (a === "assignment_save") {
      const materialId = uuidOrNull(body.material_id);
      const collectionId = uuidOrNull(body.collection_id);
      if (!materialId && !collectionId) return bad("Wybierz materiał albo kolekcję.");
      if (materialId && collectionId) return bad("Wybierz materiał albo kolekcję — nie oba.");
      const t = cleanTarget(body.target || {});
      if (t.kind === "grupa" && t.group_mode === "TYLKO_OBECNI") {
        const m = await runSql(base44, `SELECT client_email FROM public.mb_group_members WHERE group_id = ${escStr(t.group_id)}::uuid`, true);
        t.snapshot_emails = [...new Set((m || []).map((x) => lower(x.client_email)))];
      }
      const id = (await runSql(base44, `INSERT INTO public.mb_assignments
        (material_id, collection_id, target_kind, target_email, group_id, group_mode, snapshot_emails, exceptions_add, exceptions_drop, note, visible_from, visible_to, created_by)
        VALUES (${materialId ? escStr(materialId) + "::uuid" : "NULL"}, ${collectionId ? escStr(collectionId) + "::uuid" : "NULL"},
          ${escStr(t.kind)},
          ${t.kind === "osoba" ? escStr(t.emails[0]) : "NULL"},
          ${t.kind === "grupa" ? escStr(t.group_id) + "::uuid" : "NULL"},
          ${t.kind === "grupa" ? escStr(t.group_mode) : "NULL"},
          ${arr(t.kind === "grupa" ? t.snapshot_emails : [])}, ${arr(t.kind === "grupa" ? t.exceptions_add : [])}, ${arr(t.kind === "grupa" ? t.exceptions_drop : [])},
          ${esc(body.note ? String(body.note).slice(0, 2000) : null)}, ${iso(body.visible_from) ? escStr(iso(body.visible_from)) : "NULL"},
          ${iso(body.visible_to) ? escStr(iso(body.visible_to)) : "NULL"}, ${escStr(me.email)}) RETURNING id`))[0].id;
      const people = (await resolveRecipients(base44, t).catch(() => [])) || [];
      await libLog(base44, me.email, "przydzial", materialId ? "material" : "collection", materialId || collectionId,
        `${t.kind === "grupa" ? "grupa" : "osoba"} · odbiorcy: ${new Set(people.map((p) => lower(p.email))).size}`);
      return Response.json({ ok: true, id, count: new Set(people.map((p) => lower(p.email))).size });
    }

    if (a === "assignment_revoke") {
      const id = uuidOrNull(body.id);
      if (id) {
        const r = await runSql(base44, `UPDATE public.mb_assignments SET revoked_at = now()
          WHERE id = ${escStr(id)}::uuid AND revoked_at IS NULL RETURNING material_id, collection_id`);
        if (!r || !r.length) return NOT_FOUND();
        await libLog(base44, me.email, "przydzial_odebrany", r[0].material_id ? "material" : "collection", r[0].material_id || r[0].collection_id, "pojedynczy");
        return Response.json({ ok: true, count: 1 });
      }
      // Odebranie całej grupie przy jednym materiale.
      const materialId = uuidOrNull(body.material_id);
      const collectionId = uuidOrNull(body.collection_id);
      const groupId = uuidOrNull(body.group_id);
      if ((!materialId && !collectionId) || !groupId) return bad("Wskaż materiał i grupę.");
      const r = await runSql(base44, `UPDATE public.mb_assignments SET revoked_at = now()
        WHERE revoked_at IS NULL AND group_id = ${escStr(groupId)}::uuid
          AND ${materialId ? `material_id = ${escStr(materialId)}::uuid` : `collection_id = ${escStr(collectionId)}::uuid`} RETURNING 1`);
      await libLog(base44, me.email, "przydzial_odebrany", materialId ? "material" : "collection", materialId || collectionId, `grupa · ${(r || []).length}`);
      return Response.json({ ok: true, count: (r || []).length });
    }

    if (a === "assignments_of_material") {
      const materialId = uuidOrNull(body.material_id);
      const collectionId = uuidOrNull(body.collection_id);
      if (!materialId && !collectionId) return NOT_FOUND();
      const where = materialId ? `material_id = ${escStr(materialId)}::uuid` : `collection_id = ${escStr(collectionId)}::uuid`;
      const rows = await runSql(base44, `SELECT id, target_kind, target_email, group_id, group_mode, snapshot_emails, exceptions_add, exceptions_drop,
          note, visible_from, visible_to, created_at, revoked_at FROM public.mb_assignments WHERE ${where} ORDER BY created_at DESC LIMIT 500`, true);
      const groups = (await runSql(base44, `SELECT id, name, color, kind FROM public.mb_groups`, true)) || [];
      const out = [];
      const seen = new Set();
      for (const r of rows || []) {
        const t = r.target_kind === "osoba"
          ? { kind: "osoba", emails: [r.target_email] }
          : { kind: "grupa", group_id: r.group_id, group_mode: r.group_mode, snapshot_emails: r.snapshot_emails, exceptions_add: r.exceptions_add, exceptions_drop: r.exceptions_drop };
        const people = r.revoked_at ? [] : ((await resolveRecipients(base44, t).catch(() => [])) || []).map((p) => lower(p.email)).filter(Boolean);
        for (const e of people) seen.add(e);
        out.push({ ...r, group: groups.find((g) => g.id === r.group_id) || null, people: people.length, sample: people.slice(0, 5) });
      }
      const opened = materialId
        ? Number(((await runSql(base44, `SELECT count(*)::int AS n FROM public.mb_material_state WHERE material_id = ${escStr(materialId)}::uuid AND opened_at IS NOT NULL`, true))[0] || {}).n || 0)
        : null;
      return Response.json({ items: out, odbiorcy: seen.size, otwarte: opened });
    }

    if (a === "assignments_of_client") {
      const email = lower(body.email);
      if (!email.includes("@")) return bad("Podaj e-mail.");
      const lib = await libraryData(base44, email, true, true);
      return Response.json(lib);
    }

    // ---- wiadomości ----
    if (a === "messages_list") {
      const rows = await runSql(base44, `SELECT m.id, m.title, m.body_html, m.status, m.send_at, m.email_mode, m.recipient_count,
          m.attached_material_id, m.attached_collection_id, m.target, m.created_at, m.sent_at, m.withdrawn_at,
          (SELECT count(*)::int FROM public.mb_message_recipients r WHERE r.message_id = m.id) AS dostarczone,
          (SELECT count(*)::int FROM public.mb_message_recipients r WHERE r.message_id = m.id AND r.read_at IS NOT NULL) AS przeczytane
        FROM public.mb_messages m ORDER BY COALESCE(m.sent_at, m.send_at, m.created_at) DESC LIMIT 200`, true);
      const groups = (await runSql(base44, `SELECT id, name FROM public.mb_groups`, true)) || [];
      const items = (rows || []).map((m) => ({
        ...m, preview: plainText(m.body_html),
        target_label: m.target && m.target.kind === "grupa"
          ? `Grupa: ${(groups.find((g) => g.id === m.target.group_id) || {}).name || "—"}${m.target.group_mode === "TYLKO_OBECNI" ? " (tylko obecni)" : ""}`
          : m.target && m.target.emails && m.target.emails.length ? `Osoby: ${m.target.emails.length}` : "—",
      }));
      return Response.json({ items });
    }

    if (a === "message_save") {
      const id = uuidOrNull(body.id);
      const status = body.status === "ZAPLANOWANA" ? "ZAPLANOWANA" : "SZKIC";
      const html = sanitizeHtml(body.body_html);
      if (!html) return bad("Wpisz treść wiadomości.");
      const emailMode = ["BRAK", "POWIADOMIENIE", "PELNA"].includes(body.email_mode) ? body.email_mode : "BRAK";
      const sendAt = status === "ZAPLANOWANA" ? iso(body.send_at) : null;
      if (status === "ZAPLANOWANA" && !sendAt) return bad("Podaj termin wysyłki.");
      const t = cleanTarget(body.target || {});
      if (t.kind === "grupa" && t.group_mode === "TYLKO_OBECNI") {
        const m = await runSql(base44, `SELECT client_email FROM public.mb_group_members WHERE group_id = ${escStr(t.group_id)}::uuid`, true);
        t.snapshot_emails = [...new Set((m || []).map((x) => lower(x.client_email)))];
      }
      const people = (await resolveRecipients(base44, t).catch(() => [])) || [];
      const count = new Set(people.map((p) => lower(p.email))).size;
      const title = body.title ? String(body.title).trim().slice(0, 200) : null;
      const matId = uuidOrNull(body.attached_material_id);
      const colId = uuidOrNull(body.attached_collection_id);
      if (matId && colId) return bad("Dołącz materiał albo kolekcję — nie oba.");
      if (id) {
        const r = await runSql(base44, `UPDATE public.mb_messages SET title = ${esc(title)}, body_html = ${escStr(html)},
          email_mode = ${escStr(emailMode)}, attached_material_id = ${matId ? escStr(matId) + "::uuid" : "NULL"},
          attached_collection_id = ${colId ? escStr(colId) + "::uuid" : "NULL"}, target = ${escStr(JSON.stringify(t))}::jsonb,
          recipient_count = ${count}, status = ${escStr(status)}, send_at = ${sendAt ? escStr(sendAt) : "NULL"}, updated_at = now()
          WHERE id = ${escStr(id)}::uuid AND status IN ('SZKIC','ZAPLANOWANA') RETURNING id`);
        if (!r || !r.length) return NOT_FOUND();
        await libLog(base44, me.email, "wiadomosc_zmiana", "message", id, `${status} · odbiorcy: ${count}`);
        return Response.json({ ok: true, id, count });
      }
      const created = await runSql(base44, `INSERT INTO public.mb_messages
        (title, body_html, email_mode, attached_material_id, attached_collection_id, target, recipient_count, status, send_at, created_by)
        VALUES (${esc(title)}, ${escStr(html)}, ${escStr(emailMode)}, ${matId ? escStr(matId) + "::uuid" : "NULL"},
          ${colId ? escStr(colId) + "::uuid" : "NULL"}, ${escStr(JSON.stringify(t))}::jsonb, ${count},
          ${escStr(status)}, ${sendAt ? escStr(sendAt) : "NULL"}, ${escStr(me.email)}) RETURNING id`);
      await libLog(base44, me.email, "wiadomosc_szkic", "message", created[0].id, `${status} · odbiorcy: ${count}`);
      return Response.json({ ok: true, id: created[0].id, count });
    }

    if (a === "message_send") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      if (body.confirm !== true && body.count > 10) return bad("Potwierdź wysyłkę do ponad 10 osób.");
      const r = await deliverMessage(base44, id, me.email);
      if (!r.ok) return bad("Ta wiadomość nie jest już do wysłania.", 409);
      return Response.json(r);
    }

    if (a === "message_withdraw") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const r = await runSql(base44, `UPDATE public.mb_messages SET status = 'WYCOFANA', withdrawn_at = now(), updated_at = now()
        WHERE id = ${escStr(id)}::uuid AND status = 'WYSLANA' RETURNING id`);
      if (!r || !r.length) return NOT_FOUND();
      await libLog(base44, me.email, "wiadomosc_wycofana", "message", id, null);
      return Response.json({ ok: true, uwaga: "Wysłanego e-maila nie da się cofnąć." });
    }

    if (a === "message_notify_unread") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const [m] = await runSql(base44, `SELECT id, title, body_html, email_mode FROM public.mb_messages WHERE id = ${escStr(id)}::uuid AND status = 'WYSLANA'`, true);
      if (!m) return NOT_FOUND();
      if (m.email_mode === "BRAK") return bad("Ta wiadomość nie ma włączonej kopii e-mail.");
      const unread = (await runSql(base44, `SELECT client_email FROM public.mb_message_recipients
        WHERE message_id = ${escStr(id)}::uuid AND read_at IS NULL AND hidden_at IS NULL LIMIT 500`, true)) || [];
      const sent = await sendMessageEmail(base44, m, unread.map((x) => lower(x.client_email)));
      await libLog(base44, me.email, "powiadomienie_ponowne", "message", id, `nieprzeczytane: ${unread.length}`);
      return Response.json({ ok: true, ...sent, nieprzeczytane: unread.length });
    }

    if (a === "message_stats") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const rows = await runSql(base44, `SELECT r.client_email, r.delivered_at, r.read_at, r.hidden_at FROM public.mb_message_recipients r
        WHERE r.message_id = ${escStr(id)}::uuid ORDER BY r.read_at DESC NULLS LAST LIMIT 500`, true);
      const users = await sr.User.list("-created_date", 2000).catch(() => []);
      const names = {};
      for (const u of users || []) names[lower(u.email)] = String(u.imie || u.full_name || "").trim();
      return Response.json({ items: (rows || []).map((r) => ({ ...r, name: names[lower(r.client_email)] || "" })), total: (rows || []).length });
    }

    if (a === "templates_list") {
      const rows = await runSql(base44, `SELECT id, name, title, body_html, created_at FROM public.mb_templates ORDER BY name`, true);
      return Response.json({ items: (rows || []).map((t) => ({ ...t, preview: plainText(t.body_html) })) });
    }

    if (a === "template_save") {
      const name = textField(body, "name", { max: 120 });
      const html = sanitizeHtml(body.body_html);
      if (!html) return bad("Wpisz treść szablonu.");
      const title = body.title ? String(body.title).trim().slice(0, 200) : null;
      const id = uuidOrNull(body.id);
      if (id) {
        const r = await runSql(base44, `UPDATE public.mb_templates SET name = ${escStr(name)}, title = ${esc(title)}, body_html = ${escStr(html)}
          WHERE id = ${escStr(id)}::uuid RETURNING id`);
        if (!r || !r.length) return NOT_FOUND();
        return Response.json({ ok: true, id });
      }
      const c = await runSql(base44, `INSERT INTO public.mb_templates (name, title, body_html, created_by)
        VALUES (${escStr(name)}, ${esc(title)}, ${escStr(html)}, ${escStr(me.email)}) RETURNING id`);
      return Response.json({ ok: true, id: c[0].id });
    }

    if (a === "template_delete") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      await runSql(base44, `DELETE FROM public.mb_templates WHERE id = ${escStr(id)}::uuid`);
      return Response.json({ ok: true });
    }

    // ---- pulpit, historia, podgląd ----
    if (a === "dashboard") {
      const [scheduled, last, unlocking, space, s] = await Promise.all([
        runSql(base44, `SELECT count(*)::int AS n FROM public.mb_messages WHERE status = 'ZAPLANOWANA'
          AND (send_at AT TIME ZONE 'Europe/Warsaw')::date = (now() AT TIME ZONE 'Europe/Warsaw')::date`, true),
        runSql(base44, `SELECT m.id, m.title, m.sent_at,
            (SELECT count(*)::int FROM public.mb_message_recipients r WHERE r.message_id = m.id) AS dostarczone,
            (SELECT count(*)::int FROM public.mb_message_recipients r WHERE r.message_id = m.id AND r.read_at IS NOT NULL) AS przeczytane
          FROM public.mb_messages m WHERE m.status = 'WYSLANA' ORDER BY m.sent_at DESC LIMIT 1`, true),
        runSql(base44, `SELECT count(*)::int AS n FROM public.mb_assignments WHERE revoked_at IS NULL
          AND visible_from IS NOT NULL AND visible_from > now() AND visible_from < now() + interval '7 days'`, true),
        spaceUsed(base44),
        libSettings(base44, true),
      ]);
      const limitBytes = Number(s.space_limit_mb || 5120) * 1048576;
      return Response.json({
        zaplanowane_dzis: Number(((scheduled || [])[0] || {}).n || 0),
        ostatnia: (last || [])[0] || null,
        odblokowuje_sie: Number(((unlocking || [])[0] || {}).n || 0),
        przestrzen: { ...space, limit_mb: s.space_limit_mb, procent: Math.round((space.bytes / limitBytes) * 100) },
        tryby: { library_mode: s.library_mode, messages_mode: s.messages_mode, email_notify: s.email_notify },
      });
    }

    if (a === "history") {
      const rows = await runSql(base44, `SELECT at, actor, action, object_type, object_id, summary, anonymized FROM public.mb_log ORDER BY at DESC LIMIT 200`, true);
      return Response.json({ items: rows || [] });
    }

    if (a === "preview_client") {
      const email = lower(body.email);
      if (!email.includes("@")) return bad("Podaj e-mail.");
      const users = await sr.User.filter({ email }).catch(() => []);
      const u = (users || [])[0] || { email };
      const [lib, msgs] = await Promise.all([
        libraryData(base44, email, true, true),
        messagesData(base44, email, u, true),
      ]);
      return Response.json({ library: lib, messages: msgs });
    }

    return NOT_FOUND();
  } catch (e) {
    if (e && e.message === "FORBIDDEN") return Response.json({ error: "Brak dostępu" }, { status: 403 });
    const msg = String((e && e.message) || e);
    console.error("libraryAdmin:", msg.slice(0, 300));
    const known = /^(Niepoprawn|Wybierz|Wpisz|Podaj|Dozwolone|Sygnatura|Plik|Adres|Klucz|Ten rodzaj|Kolor|Ta grupa|Grupy|Dołącz|Potwierdź|Wskaż|Nieznany)/.test(msg);
    return Response.json({ error: known ? msg : "Nie udało się zapisać." }, { status: 400 });
  }
}

function arr(v) {
  const a = Array.isArray(v) ? v.map((x) => String(x || "").toLowerCase()).filter(Boolean) : [];
  return a.length ? `ARRAY[${a.map(escStr).join(",")}]::text[]` : `'{}'::text[]`;
}