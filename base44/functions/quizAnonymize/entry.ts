// TYMCZASOWE — 6.11.2026: logowanie Google pod adresem exmortis.pl (na polecenie właściciela).
// 1) google_setup: przepisuje dane klienta Google z konfiguracji Supabase Auth do app_settings „google_oauth”
//    (tylko backend; wartości nie są zwracane). 2) deploy: wdraża funkcję googleAuth z GitHub @ COMMIT.
// Autoryzacja: nagłówek X-Exm-Deploy — jednorazowy klucz (w kodzie tylko skrót SHA-256). Po wdrożeniu funkcja wraca do 410.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql } from "../../shared/supabase.ts";

const KEY_SHA = "26d2cb2fbb3d080e8e8dae694d0b547d25583ac5578d8016340e5c30e95f3aba";
const REF = "fqhvxhnbeyvwubpnuzxe";
const API = `https://api.supabase.com/v1/projects/${REF}`;
const COMMIT = "b8575ddfdbe12dd8e91c0608667620cabec57eaa";
const RAW = `https://raw.githubusercontent.com/Cobiozo/exmortis/${COMMIT}/`;
const FILES = ["supabase/functions/googleAuth/index.ts", "supabase/functions/_shared/settings.ts", "supabase/functions/_shared/compat.ts",
  "supabase/functions/_shared/supabase.ts", "supabase/functions/_shared/snapshot.ts", "supabase/functions/_shared/shim.ts"];

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const sha256 = async (s: string) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
const esc = (s: string) => "'" + String(s).replace(/'/g, "''") + "'";

Deno.serve(async (req) => {
  const key = req.headers.get("x-exm-deploy") || "";
  if (!key || (await sha256(key)) !== KEY_SHA) return Response.json({ error: "Brak autoryzacji" }, { status: 401 });
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));
  try {
    const { accessToken } = await base44.asServiceRole.connectors.getConnection("supabase");
    const mg = (p: string, init: RequestInit = {}) => fetch(`${API}${p}`, { ...init, headers: { Authorization: `Bearer ${accessToken}`, ...(init.headers || {}) } });

    if (body.action === "google_setup") {
      const r = await mg("/config/auth");
      const c = await r.json();
      const clientId = String(c?.external_google_client_id || "").split(",")[0].trim();
      const secret = String(c?.external_google_secret || "");
      if (!r.ok || !clientId || !secret) return Response.json({ ok: false, status: r.status, ma_client: !!clientId, ma_sekret: !!secret });
      const value = JSON.stringify({ clientId, clientSecret: secret, from: "supabase_auth_config", at: new Date().toISOString() });
      await runSql(base44, `INSERT INTO public.app_settings (key, value, updated_date) VALUES ('google_oauth', ${esc(value)}::jsonb, now())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_date = now()`, false);
      return Response.json({ ok: true, clientId_konczy_sie: clientId.slice(-30), sekret_dl: secret.length, skip_nonce: c?.external_google_skip_nonce_check ?? null });
    }

    if (body.action === "deploy") {
      const cur = await mg(`/functions/googleAuth`);
      const verify = cur.ok ? (await cur.json()).verify_jwt : true;
      const fd = new FormData();
      fd.append("metadata", JSON.stringify({ entrypoint_path: "supabase/functions/googleAuth/index.ts", name: "googleAuth", verify_jwt: verify }));
      for (const p of FILES) {
        const r = await fetch(RAW + p);
        if (!r.ok) throw new Error(`GitHub ${r.status} ${p}`);
        fd.append("file", new Blob([await r.text()], { type: "application/typescript" }), p);
      }
      const r = await mg(`/functions/deploy?slug=googleAuth`, { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      return Response.json({ status: r.status, version: j?.version, verify_jwt: j?.verify_jwt, istniala: cur.ok, blad: r.ok ? undefined : JSON.stringify(j).slice(0, 300) });
    }
    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e).slice(0, 300) }, { status: 500 });
  }
});
