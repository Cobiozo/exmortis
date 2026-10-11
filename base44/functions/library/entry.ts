import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { runSql, escStr } from "../../shared/supabase.ts";
import { libSettings, modeVisible, clientEmail, visibleMaterials, footerData } from "../../shared/libraryAccess.ts";
import { sanitizeHtml } from "../../shared/librarySanitize.ts";
import { embedUrl, sha256hex } from "../../shared/libraryMedia.ts";
import { getSettingsFast } from "../../shared/settings.ts";
import { libraryData, messagesData } from "../../shared/libraryView.ts";

// Strona klienta: „Moja biblioteka" i „Wiadomości".
// Tożsamość wyłącznie z sesji. Zwracamy minimum — nigdy kluczy plików, nazw grup, list odbiorców ani statystyk.

const NOT_FOUND = () => Response.json({ error: "Nie znaleziono" }, { status: 404 });
const uuid = (v) => (/^[0-9a-fA-F-]{36}$/.test(String(v || "")) ? String(v) : null);

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me) return Response.json({ error: "Zaloguj się" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const a = body.action;
    const s = await libSettings(base44);
    const admin = me.role === "admin";
    const lib = modeVisible(s.library_mode, me);
    const msg = modeVisible(s.messages_mode, me);
    const email = clientEmail(me);

    // Lekki odczyt przełączników dla /konto. Odpowiada też przy obu „off" — wtedy zakładki
    // po prostu się nie pokazują, a strona konta wygląda jak dotąd.
    if (a === "config") {
      const f = await getSettingsFast(base44, ["firma"]).catch(() => ({}));
      return Response.json({ library: lib, messages: msg, email, footer: footerData(s, f && f.firma) });
    }

    // Wyłączony moduł = nie ma czego szukać (404), a nie „brak dostępu".
    if (!lib && !msg) return NOT_FOUND();

    if (a === "my_library") {
      if (!lib) return NOT_FOUND();
      return Response.json(await libraryData(base44, email, admin, body.preview === true && admin));
    }

    if (a === "my_messages" || a === "unread") {
      if (!msg) return NOT_FOUND();
      const d = await messagesData(base44, email, me, body.preview === true && admin);
      if (a === "unread") return Response.json({ unread: d.unread, latest: d.items.find((m) => !m.read_at) || null });
      return Response.json(d);
    }

    if (a === "open_material" || a === "refresh_link") {
      if (!lib) return NOT_FOUND();
      const id = uuid(body.material_id);
      if (!id) return NOT_FOUND();
      const vis = (await visibleMaterials(base44, email, admin).catch(() => [])) || [];
      if (!vis.some((r) => r.material_id === id)) return NOT_FOUND();   // cudzy materiał = odmowa bez danych
      const [m] = await runSql(base44, `SELECT id, title, kind, file_key, external_url, video_provider, video_id, body_html, allow_download
        FROM public.mb_materials WHERE id = ${escStr(id)}::uuid AND deleted_at IS NULL`, true);
      if (!m) return NOT_FOUND();

      if (a === "refresh_link") {
        const key = await sha256hex(`${email}|${id}`);
        const rate = await runSql(base44, `SELECT public.mb_link_hit(${escStr(key)}, 30) AS r`).catch(() => null);
        if (rate && rate[0] && rate[0].r !== "ok") {
          return Response.json({ error: "Zbyt wiele odświeżeń. Spróbuj ponownie za chwilę." }, { status: 429 });
        }
      }

      let url = null;
      let ttl = null;
      if (m.kind === "PDF" || m.kind === "AUDIO") {
        ttl = m.kind === "PDF" ? 600 : 3600;
        const signed = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: m.file_key, expires_in: ttl });
        url = signed && signed.signed_url ? signed.signed_url : null;
        if (!url) return Response.json({ error: "Nie udało się przygotować pliku." }, { status: 502 });
      }
      const preview = body.preview === true && admin;
      if (a === "open_material" && !preview) {
        await runSql(base44, `INSERT INTO public.mb_material_state (client_email, material_id, opened_at)
          VALUES (${escStr(email)}, ${escStr(id)}::uuid, now())
          ON CONFLICT (client_email, material_id)
          DO UPDATE SET opened_at = COALESCE(public.mb_material_state.opened_at, EXCLUDED.opened_at)`).catch(() => {});
      }
      const out = { id: m.id, title: m.title, kind: m.kind, url, expires_in: ttl, allow_download: !!m.allow_download };
      if (m.kind === "WIDEO") out.embed = embedUrl(m.video_provider, m.video_id);
      if (m.kind === "TEKST") out.text = sanitizeHtml(m.body_html);
      if (m.kind === "LINK") out.external = m.external_url || null;
      return Response.json(out);
    }

    if (a === "mark_completed") {
      if (!lib) return NOT_FOUND();
      const id = uuid(body.material_id);
      if (!id) return NOT_FOUND();
      const vis = (await visibleMaterials(base44, email, admin).catch(() => [])) || [];
      if (!vis.some((r) => r.material_id === id)) return NOT_FOUND();
      const done = body.completed === true;
      await runSql(base44, `INSERT INTO public.mb_material_state (client_email, material_id, completed_at)
        VALUES (${escStr(email)}, ${escStr(id)}::uuid, ${done ? "now()" : "NULL"})
        ON CONFLICT (client_email, material_id) DO UPDATE SET completed_at = ${done ? "now()" : "NULL"}`);
      return Response.json({ ok: true, completed_at: done ? new Date().toISOString() : null });
    }

    if (a === "read_message" || a === "hide_message") {
      if (!msg) return NOT_FOUND();
      const id = uuid(body.message_id);
      if (!id) return NOT_FOUND();
      const col = a === "read_message" ? "read_at" : "hidden_at";
      const r = await runSql(base44, `UPDATE public.mb_message_recipients SET ${col} = COALESCE(${col}, now())
        WHERE message_id = ${escStr(id)}::uuid AND client_email = ${escStr(email)} RETURNING 1`).catch(() => []);
      if (!r || !r.length) return NOT_FOUND();                        // cudza wiadomość = brak wiersza = odmowa
      return Response.json({ ok: true });
    }

    return NOT_FOUND();
  } catch (e) {
    console.error("library:", String(e && e.message ? e.message : e).slice(0, 300));
    return Response.json({ error: "Coś poszło nie tak. Spróbuj ponownie." }, { status: 500 });
  }
}