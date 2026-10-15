import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { rpc } from "../../shared/supabase.ts";
import { libSettings, modeVisible, clientEmail, footerData } from "../../shared/libraryAccess.ts";
import { sanitizeHtml } from "../../shared/librarySanitize.ts";
import { embedUrl, sha256hex, normalizeServerVideo } from "../../shared/libraryMedia.ts";
import { getSettingsFast } from "../../shared/settings.ts";
import { libraryData, messagesData, bundleData } from "../../shared/libraryView.ts";

// Strona klienta: „Moja biblioteka" i „Wiadomości".
// Tożsamość wyłącznie z sesji. Zwracamy minimum — nigdy kluczy plików, nazw grup, list odbiorców ani statystyk.
// ETAP 2A: wszystkie ścieżki idą jednym wywołaniem RPC (zamiast kilku zapytań Management API).

const NOT_FOUND = () => Response.json({ error: "Nie znaleziono" }, { status: 404 });
const uuid = (v) => (/^[0-9a-fA-F-]{36}$/.test(String(v || "")) ? String(v) : null);

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    // Sesja i ustawienia modułu równolegle (ustawienia są w pamięci instancji przez 30 s).
    const [me, s, body] = await Promise.all([
      base44.auth.me().catch(() => null),
      libSettings(base44).catch(() => null),
      req.json().catch(() => ({})),
    ]);
    if (!me) return Response.json({ error: "Zaloguj się" }, { status: 401 });
    if (me.role === "zablokowane") return Response.json({ error: "To konto jest zablokowane." }, { status: 403 }); // stare konto po zmianie adresu
    if (!s) return Response.json({ error: "Coś poszło nie tak. Spróbuj ponownie." }, { status: 503 });
    const a = body.action;
    const admin = me.role === "admin";
    const lib = modeVisible(s.library_mode, me);
    const msg = modeVisible(s.messages_mode, me);
    const email = clientEmail(me);
    const preview = body.preview === true && admin;

    // Jedno wejście dla /konto: przełączniki + biblioteka + wiadomości + nieprzeczytane.
    // Odpowiada też przy obu „off" — wtedy zakładki po prostu się nie pokazują.
    if (a === "bundle" || a === "config") {
      // Oba moduły niedostępne dla tej osoby → odpowiedź bez żadnego zapytania do bazy.
      if (!lib && !msg) return Response.json({ library: false, messages: false });
      const [d, f] = await Promise.all([
        bundleData(base44, email, me, admin, preview).catch(() => null),
        getSettingsFast(base44, ["firma"]).catch(() => ({})),
      ]);
      const out = {
        library: lib, messages: msg, email,
        library_mode: (d && d.library_mode) || s.library_mode,
        messages_mode: (d && d.messages_mode) || s.messages_mode,
        footer: footerData(s, f && f.firma),
      };
      if (a === "bundle") {
        out.library_data = d ? d.library : null;
        out.messages_data = d ? d.messages : null;
      }
      return Response.json(out);
    }

    // Wyłączony moduł = nie ma czego szukać (404), a nie „brak dostępu".
    if (!lib && !msg) return NOT_FOUND();

    if (a === "my_library") {
      if (!lib) return NOT_FOUND();
      return Response.json(await libraryData(base44, email, admin, preview));
    }

    if (a === "my_messages" || a === "unread") {
      if (!msg) return NOT_FOUND();
      const d = await messagesData(base44, email, me, preview);
      if (a === "unread") return Response.json({ unread: d.unread, latest: d.items.find((m) => !m.read_at) || null });
      return Response.json(d);
    }

    // Dostęp + dane materiału + limit odświeżeń + zapis „otwarte" — jedno wywołanie bazy.
    // Podpisany adres pliku powstaje tutaj; klucz pliku nie opuszcza serwera.
    if (a === "open_material" || a === "refresh_link") {
      if (!lib) return NOT_FOUND();
      const id = uuid(body.material_id);
      if (!id) return NOT_FOUND();
      const refreshing = a === "refresh_link";
      const rateKey = refreshing ? await sha256hex(`${email}|${id}`) : null;
      const r = await rpc(base44, "mb_client_open", {
        p_email: email, p_admin: admin, p_material_id: id,
        p_mark_opened: !refreshing && !preview,
        p_rate_key: rateKey, p_limit: 30,
      });
      const status = (r && r.status) || "denied";
      if (status === "denied") return NOT_FOUND();
      if (status === "rate") {
        return Response.json({ error: "Zbyt wiele odświeżeń. Spróbuj ponownie za chwilę." }, { status: 429 });
      }
      const m = r.material || {};
      let url = null;
      let ttl = null;
      const videoFile = m.kind === "WIDEO" && m.video_provider === "plik";
      if (m.kind === "PDF" || m.kind === "AUDIO" || videoFile) {
        ttl = m.kind === "PDF" ? 600 : 3600;
        const signed = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: m.file_key, expires_in: ttl });
        url = signed && signed.signed_url ? signed.signed_url : null;
        if (!url) return Response.json({ error: "Nie udało się przygotować pliku." }, { status: 502 });
      }
      const out = { id: m.id, title: m.title, kind: m.kind, url, expires_in: ttl, allow_download: !!m.allow_download };
      if (m.kind === "WIDEO") out.embed = embedUrl(m.video_provider, m.video_id);
      if (m.kind === "WIDEO" && m.video_provider === "serwer") {
        // Adres sprawdzany ponownie przy każdym wydaniu — zmiana listy domen zamyka dostęp od razu.
        const ok = normalizeServerVideo(m.server_url, s.video_domains);
        if (!ok) return Response.json({ error: "Adres tego pliku nie jest już dozwolony." }, { status: 502 });
        out.url = ok;
        out.server = true;
      }
      if (m.kind === "WIDEO" && videoFile) out.file = true;
      if (m.kind === "TEKST") out.text = sanitizeHtml(m.body_html);
      if (m.kind === "LINK") out.external = m.external_url || null;
      return Response.json(out);
    }

    if (a === "mark_completed") {
      if (!lib) return NOT_FOUND();
      const id = uuid(body.material_id);
      if (!id) return NOT_FOUND();
      const done = body.completed === true;
      const ok = await rpc(base44, "mb_material_complete", { p_email: email, p_admin: admin, p_material_id: id, p_completed: done });
      if (!ok) return NOT_FOUND();
      return Response.json({ ok: true, completed_at: done ? new Date().toISOString() : null });
    }

    if (a === "read_message" || a === "hide_message") {
      if (!msg) return NOT_FOUND();
      const id = uuid(body.message_id);
      if (!id) return NOT_FOUND();
      const ok = await rpc(base44, "mb_message_flag", { p_email: email, p_message_id: id, p_hidden: a === "hide_message" });
      if (!ok) return NOT_FOUND();                                     // cudza wiadomość = brak wiersza = odmowa
      return Response.json({ ok: true });
    }

    return NOT_FOUND();
  } catch (e) {
    console.error("library:", String(e && e.message ? e.message : e).slice(0, 300));
    return Response.json({ error: "Coś poszło nie tak. Spróbuj ponownie." }, { status: 500 });
  }
}