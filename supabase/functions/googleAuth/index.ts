import { getSetting, loadAppUrl } from "../_shared/settings.ts";
import { createClientFromRequest } from "../_shared/compat.ts";

// Logowanie przez Google pod adresem exmortis.pl (zamiast domeny Supabase w oknie Google).
// 1. GET /functions/googleAuth?start=1 → przekierowanie do Google z redirect_uri = {APP_URL}/functions/googleAuth.
// 2. Google wraca na ten sam adres z ?code&state → wymiana kodu na id_token (sekret klienta tylko tutaj),
//    potem Supabase Auth (grant_type=id_token, provider google) wydaje sesję.
// 3. Przekierowanie na {APP_URL}/login#access_token=… — strona logowania przejmuje sesję tak samo jak dotąd.
// Dane klienta Google: app_settings „google_oauth” { clientId, clientSecret } (dostęp tylko backendu).
// state podpisany HMAC (sekret klienta), ważny 15 min; nonce w id_token sprawdza Supabase.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "";
const enc = new TextEncoder();
const b64u = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64u = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0)));
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");

async function hmac(secret: string, data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}
function safeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
const redirect = (url: string) => new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "no-store" } });

Deno.serve(async (req) => {
  const url = new URL(req.url);
  let app = "";
  try {
    const base44 = createClientFromRequest(req);
    app = String((await loadAppUrl(base44)) || "").replace(/\/+$/, "");
    const cfg = await getSetting(base44, "google_oauth");
    if (!app || !cfg?.clientId || !cfg?.clientSecret) throw new Error("brak konfiguracji");
    const callback = `${app}/functions/googleAuth`;
    const fail = (why: string) => redirect(`${app}/login#error=google&error_description=${encodeURIComponent(why)}`);

    // 1. Start logowania.
    if (url.searchParams.has("start")) {
      const nonce = b64u(crypto.getRandomValues(new Uint8Array(24)));
      const payload = b64u(enc.encode(JSON.stringify({ n: nonce, t: Date.now() })));
      const state = `${payload}.${await hmac(cfg.clientSecret, payload)}`;
      const hashedNonce = hex(await crypto.subtle.digest("SHA-256", enc.encode(nonce)));
      const q = new URLSearchParams({
        client_id: cfg.clientId, redirect_uri: callback, response_type: "code", scope: "openid email profile",
        state, nonce: hashedNonce, prompt: "select_account",
      });
      return redirect(`https://accounts.google.com/o/oauth2/v2/auth?${q}`);
    }

    // 2. Powrót z Google.
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state") || "";
    if (url.searchParams.get("error")) return fail("Logowanie przez Google zostało przerwane.");
    if (!code || !state.includes(".")) return fail("Nieprawidłowa odpowiedź Google.");
    const [payload, sig] = state.split(".");
    if (!safeEq(sig, await hmac(cfg.clientSecret, payload))) return fail("Nieprawidłowa sesja logowania. Spróbuj ponownie.");
    const st = JSON.parse(fromB64u(payload));
    if (!st?.n || Date.now() - Number(st.t) > 15 * 60000) return fail("Sesja logowania wygasła. Spróbuj ponownie.");

    const tok = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: callback, grant_type: "authorization_code" }),
      signal: AbortSignal.timeout(15000),
    }).then((r) => r.json());
    if (!tok?.id_token) { console.error("googleAuth token:", String(tok?.error || "").slice(0, 100)); return fail("Google nie potwierdził logowania."); }

    const s = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=id_token`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "google", id_token: tok.id_token, nonce: st.n }),
      signal: AbortSignal.timeout(15000),
    });
    const d = await s.json().catch(() => ({}));
    if (!s.ok || !d?.access_token) { console.error("googleAuth supabase:", s.status, String(d?.msg || d?.error_description || "").slice(0, 120)); return fail("Nie udało się zalogować. Spróbuj ponownie."); }

    const h = new URLSearchParams({ access_token: d.access_token, refresh_token: d.refresh_token || "", expires_in: String(d.expires_in || 3600), token_type: "bearer", provider_token: "" });
    h.delete("provider_token");
    return redirect(`${app}/login#${h}`);
  } catch (e) {
    console.error("googleAuth:", String((e as Error)?.message || e).slice(0, 200));
    return app ? redirect(`${app}/login#error=google&error_description=${encodeURIComponent("Logowanie przez Google jest chwilowo niedostępne.")}`)
      : new Response("Logowanie chwilowo niedostępne", { status: 503 });
  }
});
