import { createClientFromRequest } from "../_shared/compat.ts";
import { runSql, escStr, requireAdmin } from "../_shared/supabase.ts";
import { loadAppUrl } from "../_shared/settings.ts";
import { GCAL_SCOPES, oauthClient, saveRefresh, disconnectGoogle, authRow } from "../_shared/googleCal.ts";
import { ensureCalendar } from "../_shared/bookingGoogle.ts";

// Połączenie kalendarza Google dla rezerwacji (28.11.2026).
// POST {action:"start"} (admin) → adres zgody Google; GET ?code&state (powrót z Google) → zapis tokenu, utworzenie
// kalendarza „exmortis · sesje”, powrót do /admin/rezerwacje?google=…; POST {action:"disconnect"} (admin) → odłączenie.
// Zakresy: calendar.app.created + calendar.freebusy + email. Pełnego dostępu do kalendarzy aplikacja nie dostaje.
const enc = new TextEncoder();
const b64u = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64u = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0)));
async function hmac(secret: string, data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(`gcal:${secret}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}
function safeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
const redirect = (url: string) => new Response(null, { status: 303, headers: { Location: url, "Cache-Control": "no-store" } });
const log = (base44, actor: string, action: string, summary: string) => runSql(base44,
  `INSERT INTO public.bk_log (actor, action, object_type, object_id, summary) VALUES (${escStr(actor)}, ${escStr(action)}, 'settings', '1', ${escStr(summary)})`).catch(() => {});
const SCOPE = [...GCAL_SCOPES, "openid", "email"].join(" ");

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const base44 = createClientFromRequest(req);
  let app = "";
  try { app = String((await loadAppUrl(base44)) || "").replace(/\/+$/, ""); } catch { /* niżej */ }
  const back = (r: string) => redirect(`${app}/admin/rezerwacje?google=${encodeURIComponent(r)}`);

  // Powrót z Google.
  if (req.method === "GET") {
    if (!app) return new Response("Brak adresu strony", { status: 503 });
    try {
      if (url.searchParams.get("error")) return back("przerwano");
      const code = url.searchParams.get("code") || "";
      const state = url.searchParams.get("state") || "";
      const c = await oauthClient(base44);
      if (!code || !state.includes(".") || !c.clientId || !c.stateKey || !c.secret) return back("blad_konfiguracji");
      const [payload, sig] = state.split(".");
      if (!safeEq(sig, await hmac(c.stateKey, payload))) return back("blad_sesji");
      const st = JSON.parse(fromB64u(payload));
      if (!st?.e || Date.now() - Number(st.t) > 15 * 60000) return back("sesja_wygasla");

      const r = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, client_id: c.clientId, client_secret: c.secret, redirect_uri: `${app}/functions/googleCalendarAuth`, grant_type: "authorization_code" }),
        signal: AbortSignal.timeout(15000),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.refresh_token) { console.error("gcal token:", r.status, String(j.error || "").slice(0, 80)); return back("blad_tokenu"); }
      const granted = String(j.scope || "").split(/\s+/);
      if (!GCAL_SCOPES.every((s) => granted.includes(s))) return back("brak_zgody");
      let account: string | null = null;
      try { account = JSON.parse(fromB64u(String(j.id_token || "").split(".")[1] || ""))?.email || null; } catch { /* bez konta */ }

      const prev = await authRow(base44);
      await saveRefresh(base44, j.refresh_token, account, granted.join(" "));
      // Kalendarz z poprzedniego połączenia (inny klient albo konto) jest dla nowego tokenu niewidoczny → tworzymy nowy.
      if (!prev || prev.account !== account) {
        await runSql(base44, `UPDATE public.bk_settings SET google_calendar_id = NULL, google_status = NULL, google_error = NULL, updated_at = now() WHERE id = 1`);
      }
      await ensureCalendar(base44).catch((e) => console.error("gcal kalendarz:", String(e?.message || e).slice(0, 160)));
      // Nadchodzące potwierdzone sesje → do kolejki, cykliczne zadanie wpisze je do nowego kalendarza.
      await runSql(base44, `INSERT INTO public.bk_gcal_queue (booking_id, op, attempts, last_error)
        SELECT id, 'upsert', 0, 'nowe połączenie' FROM public.bk_bookings WHERE status = 'POTWIERDZONA' AND starts_at > now()
        ON CONFLICT (booking_id, op) DO NOTHING`).catch(() => {});
      await log(base44, String(st.e), "google_polaczono", account || "");
      return back("ok");
    } catch (e) {
      console.error("googleCalendarAuth:", String((e as Error)?.message || e).slice(0, 200));
      return back("blad");
    }
  }

  // Akcje panelu (admin z MFA).
  try {
    const me = await requireAdmin(base44);
    const body = await req.json().catch(() => ({}));
    if (body.action === "start") {
      const c = await oauthClient(base44);
      if (!app || !c.clientId || !c.stateKey) return Response.json({ error: "Brak konfiguracji klienta Google (google_oauth)." }, { status: 400 });
      if (!c.secret) return Response.json({ error: "Brak sekretu GOOGLE_CLIENT_SECRET w Supabase — dodaj go w Edge Functions → Secrets." }, { status: 400 });
      const payload = b64u(enc.encode(JSON.stringify({ e: me.email, t: Date.now(), n: b64u(crypto.getRandomValues(new Uint8Array(12))) })));
      const state = `${payload}.${await hmac(c.stateKey, payload)}`;
      const q = new URLSearchParams({
        client_id: c.clientId, redirect_uri: `${app}/functions/googleCalendarAuth`, response_type: "code", scope: SCOPE,
        access_type: "offline", prompt: "consent", include_granted_scopes: "false", state,
      });
      return Response.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${q}` });
    }
    if (body.action === "disconnect") {
      await disconnectGoogle(base44);
      await log(base44, me.email, "google_odlaczono", "");
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (e) {
    const m = String((e as Error)?.message || e);
    if (m === "FORBIDDEN") return Response.json({ error: "Brak dostępu" }, { status: 403 });
    console.error("googleCalendarAuth:", m.slice(0, 200));
    return Response.json({ error: "Nie udało się. Spróbuj ponownie." }, { status: 500 });
  }
});
