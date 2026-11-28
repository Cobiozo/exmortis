// Kalendarz Google rezerwacji — własne połączenie OAuth (28.11.2026; łącznik Base44 zniknął przy migracji).
// Token odświeżania: zaszyfrowany AES-GCM kluczem BOOKING_ENC_KEY w public.bk_google_auth (tylko backend).
// Token dostępu żyje wyłącznie w pamięci instancji. Sekret klienta: GOOGLE_CLIENT_SECRET (sekret Supabase).
import { runSql, escStr } from "./supabase.ts";
import { loadKeys } from "./booking.ts";
import { encryptHealth, decryptHealth } from "./bookingCrypto.ts";
import { getSetting } from "./settings.ts";

export const GCAL_SCOPES = [
  "https://www.googleapis.com/auth/calendar.app.created",
  "https://www.googleapis.com/auth/calendar.freebusy",
];
const TOKEN_URL = "https://oauth2.googleapis.com/token";
let cache = { tk: "", exp: 0 };

export async function oauthClient(base44) {
  const cfg = await getSetting(base44, "google_oauth").catch(() => null);
  const secret = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
  return { clientId: cfg?.clientId || "", stateKey: cfg?.stateKey || "", secret };
}

async function encKey() {
  const k = await loadKeys();
  if (!k.ok) throw new Error("brak kluczy szyfrowania");
  return k.enc;
}

export async function saveRefresh(base44, refresh: string, account: string | null, scopes: string) {
  const v = await encryptHealth(await encKey(), refresh);
  await runSql(base44, `INSERT INTO public.bk_google_auth (id, refresh_enc, account, scopes, connected_at, updated_at)
    VALUES (1, ${escStr(v)}, ${account ? escStr(account) : "NULL"}, ${escStr(scopes)}, now(), now())
    ON CONFLICT (id) DO UPDATE SET refresh_enc = EXCLUDED.refresh_enc, account = EXCLUDED.account, scopes = EXCLUDED.scopes,
      connected_at = now(), updated_at = now()`);
  cache = { tk: "", exp: 0 };
}

export async function authRow(base44) {
  const [r] = await runSql(base44, `SELECT refresh_enc, account, scopes, connected_at FROM public.bk_google_auth WHERE id = 1`, true).catch(() => []);
  return r || null;
}

// Token dostępu: z pamięci albo odświeżony z zapisanego tokenu. Rzuca, gdy brak połączenia.
export async function accessToken(base44) {
  if (cache.tk && Date.now() < cache.exp - 60000) return cache.tk;
  const row = await authRow(base44);
  if (!row?.refresh_enc) throw new Error("brak połączenia z Google");
  const refresh = await decryptHealth(await encKey(), row.refresh_enc);
  const c = await oauthClient(base44);
  if (!refresh || !c.clientId || !c.secret) throw new Error("brak konfiguracji Google");
  const r = await fetch(TOKEN_URL, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: c.clientId, client_secret: c.secret, refresh_token: refresh, grant_type: "refresh_token" }),
    signal: AbortSignal.timeout(15000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`Google: ${j.error || r.status}${j.error === "invalid_grant" ? " — połącz kalendarz ponownie" : ""}`);
  cache = { tk: j.access_token, exp: Date.now() + Number(j.expires_in || 3600) * 1000 };
  return cache.tk;
}

export async function googleConnected(base44) {
  return !!(await authRow(base44));
}

// Odłączenie: unieważnij token w Google (jeśli się da) i usuń zapis.
export async function disconnectGoogle(base44) {
  const row = await authRow(base44);
  if (row?.refresh_enc) {
    const refresh = await decryptHealth(await encKey(), row.refresh_enc).catch(() => null);
    if (refresh) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refresh)}`, { method: "POST", signal: AbortSignal.timeout(10000) }).catch(() => {});
  }
  await runSql(base44, `DELETE FROM public.bk_google_auth WHERE id = 1`);
  cache = { tk: "", exp: 0 };
}
