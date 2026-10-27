import { createClientFromRequest } from "../_shared/compat.ts";
import { runSql, rpc, esc, escStr, requireAdmin, textField } from "../_shared/supabase.ts";
import { SCHEMA_SQL, SEED_SQL, CHECKPOINT_TABLES_SQL, CHECKPOINT_FUNCS_SQL } from "../_shared/librarySchema.ts";
import { LIBRARY_RPC_SQL, CHECKPOINT_RPC_SQL } from "../_shared/libraryRpcSql.ts";
import { SCHEMA_2B_SQL, RPC_2B_SQL } from "../_shared/library2bSql.ts";
import { libSettings, resetLibSettings, MODES, resolveRecipients, randomToken, footerData, inBatches } from "../_shared/libraryAccess.ts";
import { sanitizeHtml, plainText } from "../_shared/librarySanitize.ts";
import { normalizeVideo, normalizeServerVideo, videoDomains, extOf, sniff, pdfHasJs, MAX_BYTES, ALLOWED_EXT, MAX_MB, SNIFF_BYTES, mb } from "../_shared/libraryMedia.ts";
import { libLog, deliverMessage, sendMessageEmail, renderBody } from "../_shared/libraryNotify.ts";
import { libraryData, messagesData } from "../_shared/libraryView.ts";
import { getSettingsFast } from "../_shared/settings.ts";

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
// ETAP 2A: zużycie przestrzeni (mb_admin_space) i członkostwo grup, także automatycznych
// (mb_admin_groups) liczy baza — bez osobnego zapytania na grupę i bez zapytań po Management API.

// Sprawdzenie wgranego pliku: rozszerzenie, sygnatura, rozmiar; dla PDF dodatkowo aktywna zawartość (ostrzeżenie).
async function verifyUpload(base44, kind, fileUri, fileName, declaredSize, pdfJsHint) {
  const allowed = ALLOWED_EXT[kind];
  if (!allowed) throw new Error("Ten rodzaj materiału nie przyjmuje pliku.");
  const ext = extOf(fileName);
  if (!allowed.includes(ext)) throw new Error(`Dozwolone rozszerzenia: ${allowed.map((x) => "." + x).join(", ")}.`);
  if (String(fileUri).includes("@")) throw new Error("Klucz pliku nie może zawierać adresu e-mail.");
  // Pliki w magazynie hostingu (cf/private/…) sprawdza serwer przy wgraniu: sygnatura, rozmiar, limit rodzaju
  // i aktywna treść PDF. Panel nie podpisuje do nich dostępu, więc nie potrzebuje wspólnego klucza z serwerem.
  if (/^cf\/private\//.test(String(fileUri))) {
    const size = Number(declaredSize) || 0;
    if (!size) throw new Error("Nie udało się odczytać wgranego pliku.");
    if (size > MAX_BYTES[kind]) throw new Error(`Plik jest za duży: ${mb(size)} MB, a limit to ${MAX_MB[kind]} MB.`);
    return { size, pdfJs: kind === "PDF" && pdfJsHint === true };
  }
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

// Imię do zmiennej {imię} — dokładnie ta sama reguła co firstName() u klienta.
async function imionaOf(base44, emails) {
  const list = (emails || []).slice(0, 200);
  if (!list.length) return {};
  // Podgląd dotyczy jednej osoby — nie ciągniemy listy wszystkich kont (2000 rekordów ≈ 1 s).
  const users = list.length <= 5
    ? (await Promise.all(list.map((e) => base44.asServiceRole.entities.User.filter({ email: e }).catch(() => [])))).flat()
    : await base44.asServiceRole.entities.User.list("-created_date", 2000).catch(() => []);
  const out = {};
  for (const u of users || []) {
    const e = lower(u.email);
    if (!list.includes(e)) continue;
    const a = String(u.imie || "").trim();
    const b = String(u.full_name || "").trim();
    out[e] = a || (b ? b.split(/\s+/)[0] : "");
  }
  return out;
}

// E-maile w Historii zmian są maskowane: „da***@gmail.com". Nigdy pełny adres.
function maskEmail(v) {
  const s = String(v || "").trim();
  const at = s.indexOf("@");
  if (at < 1) return s;
  return `${s.slice(0, Math.min(2, at))}***@${s.slice(at + 1)}`;
}
const maskEmailsIn = (v) => (v ? String(v).replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, (m) => maskEmail(m)) : v);

const handler = async function (req) {
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
      await runSql(base44, LIBRARY_RPC_SQL);
      await runSql(base44, SCHEMA_2B_SQL);
      await runSql(base44, RPC_2B_SQL);
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
      const [tables, funcs, rpcs] = await Promise.all([
        runSql(base44, CHECKPOINT_TABLES_SQL, true),
        runSql(base44, CHECKPOINT_FUNCS_SQL, true),
        runSql(base44, CHECKPOINT_RPC_SQL, true),
      ]);
      const space = await rpc(base44, "mb_admin_space", {});
      return Response.json({ tabele: tables || [], funkcje: funcs || [], rpc: rpcs || [], przestrzen: space });
    }

    // ---- ustawienia ----
    if (a === "settings") {
      const [s, sp] = await Promise.all([
        libSettings(base44, true),
        rpc(base44, "mb_admin_space", {}),
      ]);
      return Response.json({ settings: s, przestrzen: sp });
    }

    if (a === "save_settings") {
      const lib = MODES.includes(body.library_mode) ? body.library_mode : "off";
      const msg = MODES.includes(body.messages_mode) ? body.messages_mode : "off";
      const wa = String(body.whatsapp || "").trim();
      if (wa && !/^https:\/\/wa\.me\/[0-9]{6,20}$/.test(wa)) throw new Error("Adres WhatsApp: wyłącznie format https://wa.me/cyfry");
      const limit = int(body.space_limit_mb, 64, 1048576, 5120);
      // Brak pola w żądaniu = lista domen bez zmian (starszy formularz nie może jej wyczyścić).
      const podane = Array.isArray(body.video_domains)
        ? body.video_domains
        : (((await libSettings(base44, true).catch(() => null)) || {}).video_domains || []);
      const dom = videoDomains(podane);
      const odrzucone = podane.map((x) => String(x || "").trim()).filter((x) => x && !dom.includes(x.toLowerCase()));
      await rpc(base44, "mb_admin_settings_save", { p: {
        library_mode: lib, messages_mode: msg, email_notify: body.email_notify === true,
        whatsapp: wa, space_limit_mb: limit, video_domains: dom,
      } });
      await libLog(base44, me.email, "ustawienia", "settings", "1",
        `biblioteka=${lib} wiadomosci=${msg} mail=${body.email_notify === true ? "wl" : "wyl"} domeny=${dom.length}`);
      resetLibSettings();
      return Response.json({ ok: true, video_domains: dom, odrzucone });
    }

    // Dopisanie jednej domeny wideo (np. z edytora lekcji kursu) — reszta ustawień bez zmian.
    if (a === "add_video_domain") {
      const host = videoDomains([body.domain])[0];
      if (!host) throw new Error("Podaj samą nazwę domeny, np. wideo.exmortis.pl");
      const cur = await libSettings(base44, true);
      const dom = videoDomains([...(cur.video_domains || []), host]);
      await rpc(base44, "mb_admin_settings_save", { p: {
        library_mode: cur.library_mode, messages_mode: cur.messages_mode, email_notify: cur.email_notify === true,
        whatsapp: cur.whatsapp || "", space_limit_mb: cur.space_limit_mb || 5120, video_domains: dom,
      } });
      await libLog(base44, me.email, "ustawienia", "settings", "1", `dodana domena wideo: ${host}`);
      resetLibSettings();
      return Response.json({ ok: true, video_domains: dom });
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
      const kind = ["AUDIO", "WIDEO", "PDF", "LINK", "TEKST"].includes(body.kind) ? body.kind : null;
      const q = String(body.q || "").trim().slice(0, 100) || null;
      const [rows, sp] = await Promise.all([
        rpc(base44, "mb_admin_materials", { p_kind: kind, p_q: q }),
        rpc(base44, "mb_admin_space", {}),
      ]);
      return Response.json({ items: (rows || []).map((r) => ({ ...r, preview: plainText(r.body_html) })), przestrzen: sp });
    }

    // Rejestracja pliku wgranego z przeglądarki — dopiero po sprawdzeniu sygnatury i rozmiaru.
    if (a === "material_register") {
      const kind = ["AUDIO", "PDF", "WIDEO"].includes(body.kind) ? body.kind : null;
      if (!kind) return bad("Wybierz rodzaj pliku.");
      const fileUri = textField(body, "file_uri", { max: 500 });
      const fileName = textField(body, "file_name", { max: 300 });
      const title = String(body.title || fileName.replace(/\.[a-z0-9]{1,8}$/i, "")).trim().slice(0, 200);
      if (!title) return bad("Wpisz tytuł materiału.");
      const v = await verifyUpload(base44, kind, fileUri, fileName, body.file_size, body.pdf_js).catch((e) => ({ err: e.message }));
      if (v.err) {
        await libLog(base44, me.email, "plik_odrzucony", "material", null, `${kind}: ${v.err}`);
        return bad(v.err);
      }
      const reg = await rpc(base44, "mb_admin_material_register", { p: {
        kind, title, file_key: fileUri, file_name: fileName, file_size: v.size, pdf_js: v.pdfJs, actor: me.email,
      } });
      const id = reg.id;
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
      const payload = { id: id || null, kind, title, actor: me.email };

      if (kind === "LINK") {
        const url = String(body.external_url || "").trim();
        if (!/^https:\/\/\S+$/.test(url)) return bad("Adres musi zaczynać się od https://");
        payload.external_url = url;
      } else if (kind === "WIDEO") {
        const src = ["link", "plik", "serwer"].includes(body.video_source) ? body.video_source : "link";
        payload.video_source = src;
        if (src === "serwer") {
          const s = await libSettings(base44);
          const ok = normalizeServerVideo(body.server_url, s.video_domains);
          if (!ok) return bad("Adres musi być https, kończyć się .mp4, .m4v albo .webm i pochodzić z domeny wpisanej w ustawieniach.");
          payload.server_url = ok;
        } else if (src === "plik") {
          if (!id) return bad("Najpierw wgraj plik wideo.");
          payload.keep_video = true;
        } else {
          const v = normalizeVideo(body.external_url);
          if (!v && !id) return bad("Dozwolone są tylko filmy z YouTube, Vimeo i Bunny — wklej poprawny adres https.");
          // Pusty adres przy edycji = zostawiamy dotychczasowego dostawcę i identyfikator.
          if (v) { payload.video_provider = v.provider; payload.video_id = v.id; }
          else payload.keep_video = true;
        }
      } else if (kind === "TEKST") {
        const html = sanitizeHtml(body.body_html);
        if (!html) return bad("Wpisz treść materiału.");
        payload.body_html = html;
      } else if (!id) {
        return bad("Najpierw wgraj plik (PDF albo audio).");
      }

      // Kolumny właściwe dla rodzaju ustawia baza — funkcja wysyła tylko wartości.
      const saved = await rpc(base44, "mb_admin_material_save", { p: {
        ...payload, description: desc, stage, tags,
        duration_s: int(body.duration_s, 0, 100000, null), pages: int(body.pages, 0, 100000, null),
        allow_download: allowDownload, source: body.source ? String(body.source).slice(0, 200) : null,
      } });
      if (!saved || !saved.ok) return NOT_FOUND();
      await libLog(base44, me.email, id ? "material_zmiana" : "material_dodany", "material", saved.id, id ? title : `${kind} ${title}`);
      return Response.json({ ok: true, id: saved.id });
    }

    // Zamiana pliku: nowa wersja, jedna poprzednia do cofnięcia, przydziały bez zmian.
    if (a === "material_replace") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const [m] = await runSql(base44, `SELECT id, kind, title FROM public.mb_materials WHERE id = ${escStr(id)}::uuid AND deleted_at IS NULL`, true);
      if (!m) return NOT_FOUND();
      if (m.kind !== "PDF" && m.kind !== "AUDIO" && m.kind !== "WIDEO") return bad("Plik można zamienić tylko w materiale PDF, audio albo wideo.");
      const fileUri = textField(body, "file_uri", { max: 500 });
      const fileName = textField(body, "file_name", { max: 300 });
      const v = await verifyUpload(base44, m.kind, fileUri, fileName, body.file_size, body.pdf_js).catch((e) => ({ err: e.message }));
      if (v.err) {
        await libLog(base44, me.email, "plik_odrzucony", "material", id, `${m.kind}: ${v.err}`);
        return bad(v.err);
      }
      await runSql(base44, `UPDATE public.mb_materials SET
        prev_file_key = file_key, prev_file_name = file_name, prev_file_size = file_size,
        file_key = ${escStr(fileUri)}, file_name = ${escStr(fileName)}, file_size = ${v.size},
        file_version = file_version + 1, pdf_js_warning = ${v.pdfJs ? "TRUE" : "FALSE"},
        video_provider = CASE WHEN kind = 'WIDEO' THEN 'plik' ELSE video_provider END,
        server_url = CASE WHEN kind = 'WIDEO' THEN NULL ELSE server_url END,
        updated_at = now()
        WHERE id = ${escStr(id)}::uuid`);
      await libLog(base44, me.email, "plik_zamieniony", "material", id, `${m.kind} ${mb(v.size)} MB`);
      return Response.json({ ok: true, id, file_size: v.size, pdf_js_warning: v.pdfJs });
    }

    // Ile osób straci dostęp po usunięciu materiału — do okna potwierdzenia.
    if (a === "material_impact") {
      const materialId = uuidOrNull(body.material_id);
      if (!materialId) return NOT_FOUND();
      const r = await rpc(base44, "mb_admin_material_impact", { p_material: materialId });
      return Response.json({ osoby: (r && r.osoby) || 0, przydzialy: (r && r.przydzialy) || 0 });
    }

    // Przywrócenie poprzedniej wersji pliku (jedna wstecz), bez zmiany przydziałów.
    if (a === "material_restore_prev") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const r = await runSql(base44, `UPDATE public.mb_materials SET
        file_key = prev_file_key, file_name = prev_file_name, file_size = prev_file_size,
        prev_file_key = file_key, prev_file_name = file_name, prev_file_size = file_size,
        file_version = file_version + 1, updated_at = now()
        WHERE id = ${escStr(id)}::uuid AND deleted_at IS NULL AND prev_file_key IS NOT NULL RETURNING id`);
      if (!r || !r.length) return bad("Nie ma poprzedniej wersji pliku do przywrócenia.");
      await libLog(base44, me.email, "plik_przywrocony", "material", id, "przywrocono poprzednia wersje");
      return Response.json({ ok: true, id });
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
      const items = await rpc(base44, "mb_admin_collections", {});
      return Response.json({ items: items || [] });
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
    // Grupy z członkami (także z grup automatycznych) — jednym wywołaniem bazy.
    if (a === "groups_list") {
      const items = await rpc(base44, "mb_admin_groups", {});
      return Response.json({ items: items || [] });
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
        const tid = uuidOrNull(body.rule && body.rule.type_id);
        rule = typ === "produkt" ? { typ, id: uuidOrNull(body.rule.id) } : { typ, ...(tid ? { type_id: tid } : {}) };
      }
      if (id) {
        const r = await runSql(base44, `UPDATE public.mb_groups SET name = ${escStr(name)}, color = ${esc(color)},
          description = ${esc(desc)}, kind = ${escStr(kind)}, rule = ${rule ? escStr(JSON.stringify(rule)) + "::jsonb" : "NULL"}, updated_at = now()
          WHERE id = ${escStr(id)}::uuid RETURNING id`);
        if (!r || !r.length) return NOT_FOUND();
        await libLog(base44, me.email, "grupa_zmiana", "group", id, name);
        return Response.json({ ok: true, id });
      }
      const created = await runSql(base44, `INSERT INTO public.mb_groups (name, color, description, kind, rule, accepted_at, created_by)
        VALUES (${escStr(name)}, ${esc(color)}, ${esc(desc)}, ${escStr(kind)}, ${rule ? escStr(JSON.stringify(rule)) + "::jsonb" : "NULL"}, now(), ${escStr(me.email)}) RETURNING id`);
      await libLog(base44, me.email, "grupa_dodana", "group", created[0].id, name);
      return Response.json({ ok: true, id: created[0].id });
    }

    // Zatwierdzenie grupy startowej („Zostaw") — znika dopisek „do akceptacji".
    if (a === "group_accept") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const r = await runSql(base44, `UPDATE public.mb_groups SET accepted_at = now(), updated_at = now()
        WHERE id = ${escStr(id)}::uuid AND accepted_at IS NULL RETURNING name`);
      if (!r || !r.length) return NOT_FOUND();
      await libLog(base44, me.email, "grupa_zatwierdzona", "group", id, r[0].name);
      return Response.json({ ok: true });
    }

    // Karta grupy: członkowie teraz, materiały grupy, wiadomości wysłane do grupy.
    if (a === "group_detail") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const d = await rpc(base44, "mb_admin_group_detail", { p_group: id });
      if (!d || !d.group) return NOT_FOUND();
      const members = ((d.members || [])).map((x) => lower(x)).filter(Boolean);
      const names = await namesOf(base44, members);
      return Response.json({
        group: d.group,
        members: members.map((e) => ({ email: e, name: names[e] || "" })),
        materials: d.materials || [], messages: d.messages || [],
      });
    }

    // Listy do budowy reguły grupy automatycznej: produkty ze Skarbca i typy spotkań.
    if (a === "rule_options") {
      const [produkty, typy] = await Promise.all([
        runSql(base44, `SELECT id, name FROM public.products ORDER BY sort_order NULLS LAST, name LIMIT 500`, true).catch(() => []),
        runSql(base44, `SELECT id, name FROM public.bk_types ORDER BY name LIMIT 200`, true).catch(() => []),
      ]);
      return Response.json({ produkty: produkty || [], typy: typy || [] });
    }

    // Usunięcie grupy: pytamy, co z materiałami członków — odebranie albo zostawienie indywidualnie.
    if (a === "group_delete") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const take = body.materials === "odbierz";
      const [g] = await runSql(base44, `SELECT id, name, kind FROM public.mb_groups WHERE id = ${escStr(id)}::uuid`, true);
      if (!g) return NOT_FOUND();
      // Członkostwo liczone tak samo jak przy widoczności: ręczne + (dla automatycznej) aktualny wynik reguły.
      const members = ((await rpc(base44, "mb_group_members_now", { p_group: id }).catch(() => [])) || []).map((m) => lower(m.email));
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
            : members.filter((e) => !emailsOf(a2.exceptions_drop).includes(e)).concat(emailsOf(a2.exceptions_add));
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
      const d = await rpc(base44, "mb_admin_group_detail", { p_group: id });
      const g = d && d.group;
      if (!g) return NOT_FOUND();
      if (g.kind === "AUTOMATYCZNA") return bad("Ta grupa jest automatyczna — członków wyznaczają zakupy i pakiety.");
      const list = emailsOf(body.emails);
      if (!list.length) return bad("Wybierz osoby.");
      const n = Number(await rpc(base44, "mb_admin_group_members", {
        p_group: id, p_emails: list, p_add: a === "group_members_add", p_actor: me.email,
      }));
      await libLog(base44, me.email, a === "group_members_add" ? "grupa_dodanie" : "grupa_usuniecie", "group", id, `${g.name} · ${list.length}`);
      return Response.json({ ok: true, count: list.length, zmienione: n });
    }

    // ---- klienci ----
    if (a === "clients_list") {
      // Konta Base44 i fakty z tabel mb_* (grupy, pakiet) — równolegle, jednym zapytaniem do bazy.
      const [users, mb, groups] = await Promise.all([
        sr.User.list("-created_date", 2000).catch(() => []),
        rpc(base44, "mb_admin_clients_mb", {}),
        rpc(base44, "mb_admin_groups", {}),
      ]);
      const facts = new Map(((mb || [])).map((r) => [lower(r.email), r]));
      const rows = [];
      for (const u of users || []) {
        const e = lower(u.email);
        if (!e || u.role === "zablokowane") continue;
        const f = facts.get(e) || { groups: [], package: false };
        rows.push({
          email: e, name: String(u.imie || u.full_name || "").trim(), joined: u.created_date || null,
          groups: f.groups || [], package: !!f.package, blocked: u.role === "zablokowane",
        });
      }
      const q = lower(body.q);
      const gids = [...new Set((Array.isArray(body.group_ids) ? body.group_ids : [body.group_id]).map(uuidOrNull).filter(Boolean))];
      const mode = body.group_mode === "any" ? "any" : "all";
      let out = rows;
      if (q) out = out.filter((r) => r.email.includes(q) || lower(r.name).includes(q));
      if (gids.length) out = out.filter((r) => (mode === "any"
        ? gids.some((g) => r.groups.some((x) => x.id === g))
        : gids.every((g) => r.groups.some((x) => x.id === g))));
      if (body.no_group === true) out = out.filter((r) => !r.groups.length);
      if (body.has_package === true) out = out.filter((r) => r.package);
      const grupy = ((groups || [])).map((g) => ({ id: g.id, name: g.name, color: g.color || null, kind: g.kind, rule: g.rule || null }));
      return Response.json({ items: out, total: out.length, grupy });
    }

    if (a === "client_detail") {
      const email = lower(body.email);
      if (!email.includes("@")) return bad("Podaj e-mail.");
      const [users, mb, lib] = await Promise.all([
        sr.User.filter({ email }).catch(() => []),
        rpc(base44, "mb_admin_client_mb", { p_email: email }),
        libraryData(base44, email, true, true),
      ]);
      const u = (users || [])[0] || null;
      // Zostaje tylko dołożenie imienia do wiadomości — biblioteka i konto poszły równolegle.
      const msgs = await messagesData(base44, email, u || { email }, true);
      const d = mb || {};
      return Response.json({
        client: { email, name: u ? String(u.imie || u.full_name || "").trim() : "", joined: u ? u.created_date : null, role: u ? u.role : null },
        groups: d.groups || [], materials: lib.items, messages: msgs.items,
        sends: d.sends || [], packages: d.packages || [], assignments: d.assignments || [],
      });
    }

    // ---- przydziały ----
    if (a === "assignment_preview") {
      const t = cleanTarget(body.target || {});
      const emails = [...new Set((((await rpc(base44, "mb_admin_assignment_preview", { p_target: t })) || [])).map(lower).filter(Boolean))];
      const names = await namesOf(base44, emails);
      return Response.json({ count: emails.length, emails, names });
    }

    // Przydział zbiorczy z listy klientów: jeden materiał, wiele osób.
    if (a === "assignment_bulk") {
      const materialId = uuidOrNull(body.material_id);
      if (!materialId) return bad("Wybierz materiał.");
      const emails = emailsOf(body.emails, 500);
      if (!emails.length) return bad("Wybierz osoby.");
      const note = body.note ? String(body.note).slice(0, 2000) : null;
      const n = await rpc(base44, "mb_admin_assignment_bulk", {
        p_material: materialId, p_emails: emails, p_note: note,
        p_from: iso(body.visible_from), p_to: iso(body.visible_to), p_actor: me.email,
      });
      await libLog(base44, me.email, "przydzial_zbiorczy", "material", materialId, `osoby: ${emails.length}`);
      return Response.json({ ok: true, count: Number(n) || 0 });
    }

    // Przydział kilku materiałów naraz — jedno wywołanie bazy, jeden wpis w historii.
    if (a === "assign_many") {
      const ids = [...new Set((Array.isArray(body.material_ids) ? body.material_ids : []).map(uuidOrNull).filter(Boolean))].slice(0, 100);
      if (!ids.length) return bad("Zaznacz materiały.");
      const t = cleanTarget(body.target || {});
      const r = await rpc(base44, "mb_admin_assign_many", {
        p_materials: ids, p_target: t,
        p_note: body.note ? String(body.note).slice(0, 2000) : null,
        p_from: iso(body.visible_from), p_to: iso(body.visible_to), p_actor: me.email,
      });
      await libLog(base44, me.email, "przydzial_zbiorczy", "material", null,
        `materialy: ${ids.length} · odbiorcy: ${(r && r.osoby) || 0}`);
      return Response.json({ ok: true, ...(r || {}) });
    }

    if (a === "assignment_save") {
      const materialId = uuidOrNull(body.material_id);
      const collectionId = uuidOrNull(body.collection_id);
      if (!materialId && !collectionId) return bad("Wybierz materiał albo kolekcję.");
      if (materialId && collectionId) return bad("Wybierz materiał albo kolekcję — nie oba.");
      const t = cleanTarget(body.target || {});
      // Kilka osób naraz: materiał — jednym wywołaniem bazy; kolekcja — przydział na każdą osobę.
      if (t.kind === "osoba" && t.emails.length > 1) {
        const note = body.note ? String(body.note).slice(0, 2000) : null;
        let count = 0;
        if (materialId) {
          const rm = await rpc(base44, "mb_admin_assign_many", {
            p_materials: [materialId], p_target: t, p_note: note,
            p_from: iso(body.visible_from), p_to: iso(body.visible_to), p_actor: me.email,
          });
          count = Number((rm && rm.osoby) || 0);
        } else {
          // Kolekcja dla wielu osób: zapisy idą partiami, nie jeden po drugim.
          // Wcześniej przy kilkuset osobach była to seria minut i przerwane zadanie w połowie.
          const from = iso(body.visible_from), to = iso(body.visible_to);
          const done = await inBatches(t.emails.slice(0, 500), 8, (e) => rpc(base44, "mb_admin_assignment_save", { p: {
            material_id: null, collection_id: collectionId, target_kind: "osoba", target_email: e,
            group_id: null, group_mode: null, snapshot_emails: [], exceptions_add: [], exceptions_drop: [],
            note, visible_from: from, visible_to: to, actor: me.email,
          } }));
          count = done.length;
        }
        await libLog(base44, me.email, "przydzial", materialId ? "material" : "collection", materialId || collectionId,
          `osoby · odbiorcy: ${count}`);
        return Response.json({ ok: true, count });
      }
      // Snapshot „tylko obecni" wyznacza baza w tej samej transakcji co zapis przydziału.
      const r = await rpc(base44, "mb_admin_assignment_save", { p: {
        material_id: materialId, collection_id: collectionId,
        target_kind: t.kind,
        target_email: t.kind === "osoba" ? t.emails[0] : null,
        group_id: t.kind === "grupa" ? t.group_id : null,
        group_mode: t.kind === "grupa" ? t.group_mode : null,
        snapshot_emails: t.kind === "grupa" ? t.snapshot_emails : [],
        exceptions_add: t.kind === "grupa" ? t.exceptions_add : [],
        exceptions_drop: t.kind === "grupa" ? t.exceptions_drop : [],
        note: body.note ? String(body.note).slice(0, 2000) : null,
        visible_from: iso(body.visible_from), visible_to: iso(body.visible_to), actor: me.email,
      } });
      const count = Number((r && r.count) || 0);
      await libLog(base44, me.email, "przydzial", materialId ? "material" : "collection", materialId || collectionId,
        `${t.kind === "grupa" ? "grupa" : "osoba"} · odbiorcy: ${count}`);
      return Response.json({ ok: true, id: r && r.id, count });
    }

    if (a === "assignment_revoke") {
      const id = uuidOrNull(body.id);
      if (id) {
        const n = Number(await rpc(base44, "mb_admin_assignment_revoke", { p_id: id }));
        if (!n) return NOT_FOUND();
        await libLog(base44, me.email, "przydzial_odebrany", "przydzial", id, "pojedynczy");
        return Response.json({ ok: true, count: n });
      }
      // Odebranie całej grupie przy jednym materiale.
      const materialId = uuidOrNull(body.material_id);
      const collectionId = uuidOrNull(body.collection_id);
      const groupId = uuidOrNull(body.group_id);
      if ((!materialId && !collectionId) || !groupId) return bad("Wskaż materiał i grupę.");
      const n = Number(await rpc(base44, "mb_admin_assignment_revoke", {
        p_material: materialId, p_collection: collectionId, p_group: groupId,
      }));
      await libLog(base44, me.email, "przydzial_odebrany", materialId ? "material" : "collection", materialId || collectionId, `grupa · ${n}`);
      return Response.json({ ok: true, count: n });
    }

    if (a === "assignments_of_material") {
      const materialId = uuidOrNull(body.material_id);
      const collectionId = uuidOrNull(body.collection_id);
      if (!materialId && !collectionId) return NOT_FOUND();
      // Odbiorcy, grupy i licznik otwarć liczone w bazie — jedno wywołanie zamiast pętli po przydziałach.
      const d = (await rpc(base44, "mb_admin_assignments_of", { p_material: materialId, p_collection: collectionId })) || {};
      return Response.json({ items: d.items || [], odbiorcy: d.odbiorcy || 0, otwarte: d.otwarte === undefined ? null : d.otwarte });
    }

    if (a === "assignments_of_client") {
      const email = lower(body.email);
      if (!email.includes("@")) return bad("Podaj e-mail.");
      const lib = await libraryData(base44, email, true, true);
      return Response.json(lib);
    }

    // ---- wiadomości ----
    if (a === "messages_list") {
      const d = (await rpc(base44, "mb_admin_messages", {})) || { items: [], liczniki: null };
      const items = (d.items || []).map((m) => ({
        ...m, preview: plainText(m.body_html),
        target_label: m.target && m.target.kind === "grupa"
          ? `Grupa: ${m.group_name || "—"}${m.target.group_mode === "TYLKO_OBECNI" ? " (tylko obecni)" : ""}`
          : m.target && m.target.emails && m.target.emails.length ? `Osoby: ${m.target.emails.length}` : "—",
      }));
      return Response.json({ items, liczniki: d.liczniki || { wyslane: 0, zaplanowane: 0, szkice: 0, wycofane: 0 } });
    }

    // Podgląd „tak zobaczy to [osoba]" — ta sama ścieżka renderBody + sanitizeHtml co u klienta.
    if (a === "message_preview") {
      const html = sanitizeHtml(body.body_html);
      const t = cleanTarget(body.target || {});
      const people = (await resolveRecipients(base44, t).catch(() => [])) || [];
      const emails = [...new Set(people.map((p) => lower(p.email)).filter(Boolean))];
      const want = lower(body.email);
      const pick = want && emails.includes(want) ? want : emails[0] || null;
      const imiona = pick ? await imionaOf(base44, [pick]) : {};
      const imie = pick ? imiona[pick] || "" : "";
      const s = await libSettings(base44);
      return Response.json({
        count: emails.length, emails: emails.slice(0, 500),
        email: pick, imie: imie || null,
        html: pick ? sanitizeHtml(renderBody(html, imie)) : null,
        stopka: footerData(s, (await getSettingsFast(base44, ["firma"]).catch(() => ({}))).firma),
      });
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
      const title = body.title ? String(body.title).trim().slice(0, 200) : null;
      // Brak pola attachments przy edycji = załączniki bez zmian; czyścimy tylko przy jawnie pustej tablicy.
      let attIn = body.attachments;
      if (!Array.isArray(attIn)) {
        attIn = id && !body.attached_material_id && !body.attached_collection_id
          ? ((await rpc(base44, "mb_admin_message_attachments", { p_id: id }).catch(() => [])) || [])
          : [];
      }
      const att = attIn.slice(0, 10)
        .map((x) => ({ material_id: uuidOrNull(x && x.material_id), collection_id: uuidOrNull(x && x.collection_id) }))
        .filter((x) => (x.material_id ? 1 : 0) + (x.collection_id ? 1 : 0) === 1);
      const matId = uuidOrNull(body.attached_material_id);
      const colId = uuidOrNull(body.attached_collection_id);
      if (matId && colId) return bad("Dołącz materiał albo kolekcję — nie oba.");
      // Snapshot „tylko obecni" i liczba odbiorców powstają w bazie, w tej samej transakcji co zapis.
      const saved = await rpc(base44, "mb_admin_message_save", { p: {
        id: id || null, title, body_html: html, email_mode: emailMode, target: t,
        attachments: att,
        attached_material_id: matId, attached_collection_id: colId, status, send_at: sendAt, actor: me.email,
      } });
      if (!saved || !saved.ok) return NOT_FOUND();
      await libLog(base44, me.email, id ? "wiadomosc_zmiana" : "wiadomosc_szkic", "message", saved.id,
        `${status} · odbiorcy: ${saved.count} · zalaczniki: ${att.length}`);
      return Response.json({ ok: true, id: saved.id, count: saved.count });
    }

    if (a === "message_send") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const used = Number(await rpc(base44, "mb_admin_message_send_rate", {}).catch(() => 0)) || 0;
      if (used >= 20) {
        return bad("Wykorzystany limit 20 wysłanych wiadomości na godzinę. Kolejną wyślesz po godzinie.", 429);
      }
      if (body.confirm !== true && body.count > 10) return bad("Potwierdź wysyłkę do ponad 10 osób.");
      // „Wyślij teraz": przejęcie szkicu i wysyłka — jedno przejście przez bazę (p_promote).
      const r = await deliverMessage(base44, id, me.email);
      if (!r.ok) return bad("Ta wiadomość nie jest już do wysłania.", 409);
      return Response.json(r);
    }

    // Poprawka literówki w wysłanej wiadomości — bez ponownego e-maila, wpis w Historii zmian.
    if (a === "message_edit_sent") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const html = sanitizeHtml(body.body_html);
      if (!html) return bad("Wpisz treść wiadomości.");
      const title = body.title ? String(body.title).trim().slice(0, 200) : null;
      const ok = await rpc(base44, "mb_admin_message_edit", { p_id: id, p_title: title, p_body_html: html });
      if (!ok) return NOT_FOUND();
      await libLog(base44, me.email, "wiadomosc_poprawiona", "message", id, "poprawka tresci po wyslaniu, bez ponownego e-maila");
      return Response.json({ ok: true });
    }

    // Anulowanie zaplanowanej — tylko dopóki zadanie jej nie przejęło.
    if (a === "message_cancel") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const ok = await rpc(base44, "mb_admin_message_cancel", { p_id: id });
      if (!ok) return bad("Tej wiadomości nie można już anulować — zadanie ją przejęło.", 409);
      await libLog(base44, me.email, "wiadomosc_anulowana", "message", id, "zaplanowana wrocila do szkicow");
      return Response.json({ ok: true });
    }

    // Usunięcie: tylko szkic albo wiadomość wycofana. Wysłanej nie usuwamy — tę się wycofuje.
    if (a === "message_delete") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const ok = await rpc(base44, "mb_admin_message_delete", { p_id: id });
      if (!ok) return bad("Usunąć można tylko szkic albo wiadomość wycofaną.", 409);
      await libLog(base44, me.email, "wiadomosc_usunieta", "message", id, null);
      return Response.json({ ok: true });
    }

    if (a === "message_withdraw") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const ok = await rpc(base44, "mb_admin_message_withdraw", { p_id: id });
      if (!ok) return NOT_FOUND();
      await libLog(base44, me.email, "wiadomosc_wycofana", "message", id, null);
      return Response.json({ ok: true, uwaga: "Wysłanego e-maila nie da się cofnąć." });
    }

    if (a === "message_notify_unread") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const d = await rpc(base44, "mb_admin_message_notify", { p_id: id });
      if (!d || !d.message) return NOT_FOUND();
      if (d.message.email_mode === "BRAK") return bad("Ta wiadomość nie ma włączonej kopii e-mail.");
      if (d.niedawno) return bad("Powiadomienie do nieprzeczytanych zostało już wysłane w ciągu ostatnich 24 godzin.", 429);
      const emails = (d.emails || []).map(lower);
      const sent = await sendMessageEmail(base44, d.message, emails);
      await libLog(base44, me.email, "powiadomienie_ponowne", "message", id, `nieprzeczytane: ${emails.length}`);
      return Response.json({ ok: true, ...sent, nieprzeczytane: emails.length });
    }

    if (a === "message_stats") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      const rows = await rpc(base44, "mb_admin_message_stats", { p_id: id });
      const users = await sr.User.list("-created_date", 2000).catch(() => []);
      const names = {};
      for (const u of users || []) names[lower(u.email)] = String(u.imie || u.full_name || "").trim();
      return Response.json({ items: (rows || []).map((r) => ({ ...r, name: names[lower(r.client_email)] || "" })), total: (rows || []).length });
    }

    if (a === "templates_list") {
      const rows = await rpc(base44, "mb_admin_templates", {});
      return Response.json({ items: (rows || []).map((t) => ({ ...t, preview: plainText(t.body_html) })) });
    }

    if (a === "template_save") {
      const name = textField(body, "name", { max: 120 });
      const html = sanitizeHtml(body.body_html);
      if (!html) return bad("Wpisz treść szablonu.");
      const title = body.title ? String(body.title).trim().slice(0, 200) : null;
      const id = uuidOrNull(body.id);
      const saved = await rpc(base44, "mb_admin_template_save", { p: { id: id || null, name, title, body_html: html, actor: me.email } });
      if (!saved || !saved.ok) return NOT_FOUND();
      return Response.json({ ok: true, id: saved.id });
    }

    if (a === "template_delete") {
      const id = uuidOrNull(body.id);
      if (!id) return NOT_FOUND();
      await rpc(base44, "mb_admin_template_delete", { p_id: id });
      return Response.json({ ok: true });
    }

    // ---- pulpit, historia, podgląd ----
    // Cały pulpit (liczniki, ostatnia wysyłka, przestrzeń, przełączniki) — jedno wywołanie bazy.
    if (a === "dashboard") {
      const d = (await rpc(base44, "mb_admin_dashboard", {})) || {};
      return Response.json({
        zaplanowane_dzis: d.zaplanowane_dzis || 0,
        ostatnia: d.ostatnia || null,
        odblokowuje_sie: d.odblokowuje_sie || 0,
        przestrzen: d.przestrzen || null,
        tryby: d.tryby || null,
      });
    }

    // Historia zmian: bez treści wiadomości, e-maile maskowane („da***@gmail.com").
    if (a === "history") {
      // Uwaga: pole akcji żądania nazywa się „action", więc filtr rodzaju działania podaje się jako „action_filter".
      const filterAction = body.action_filter ? String(body.action_filter).slice(0, 60) : null;
      const days = int(body.days, 1, 3650, null);
      const d = (await rpc(base44, "mb_admin_history", { p_action: filterAction, p_days: days })) || {};
      return Response.json({
        items: (d.items || []).map((r) => ({ ...r, actor: maskEmail(r.actor), summary: maskEmailsIn(r.summary) })),
        akcje: d.akcje || [],
      });
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
      await libLog(base44, me.email, "podglad_klienta", "klient", null, "podglad oczami klienta");
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

// === Supabase Edge (wygenerowane przez docs/tech/migruj.mjs) ===
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const res = await handler(req);
    const h = new Headers(res.headers);
    for (const [k, v] of Object.entries(CORS)) h.set(k, v);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  } catch (e) {
    const msg = String(e?.message || e);
    const status = msg === "FORBIDDEN" ? 403 : e && e.isValidation ? 400 : 500;
    console.error("edge:", msg.slice(0, 300));
    return Response.json({ error: msg.slice(0, 300) }, { status, headers: CORS });
  }
});