// TYMCZASOWE — 6.11.2026: logowanie Google pod adresem exmortis.pl (na polecenie właściciela).
// 1) google_setup: identyfikator klienta Google + losowy klucz state do app_settings „google_oauth” (bez sekretu). 2) deploy: wdraża funkcję googleAuth z GitHub @ COMMIT.
// Autoryzacja: nagłówek X-Exm-Deploy — jednorazowy klucz (w kodzie tylko skrót SHA-256). Po wdrożeniu funkcja wraca do 410.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql } from "../../shared/supabase.ts";

const KEY_SHA = "2b9b268a5c88210f7cfd16c7567feadd4e5309888deed65370cb87a7612a9de0";
const REF = "fqhvxhnbeyvwubpnuzxe";
const API = `https://api.supabase.com/v1/projects/${REF}`;
const COMMIT = "d0d8c406245c6947b42b02da1c252303f8e5a978";
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
      // Identyfikator klienta Google (publiczny) z konfiguracji Supabase Auth + losowy klucz do podpisu state.
      // Sekret klienta Google nie jest potrzebny (id_token przez form_post) i nie jest kopiowany.
      const r = await mg("/config/auth");
      const c = await r.json();
      const clientId = String(c?.external_google_client_id || "").split(",")[0].trim();
      if (!r.ok || !clientId) return Response.json({ ok: false, status: r.status });
      const stateKey = hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
      const value = JSON.stringify({ clientId, stateKey, at: new Date().toISOString() });
      await runSql(base44, `INSERT INTO public.app_settings (key, value, updated_date) VALUES ('google_oauth', ${esc(value)}::jsonb, now())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_date = now()`, false);
      const chk = await runSql(base44, `SELECT (value ? 'clientSecret') AS ma_sekret, length(value->>'stateKey') AS klucz FROM public.app_settings WHERE key='google_oauth'`, true);
      return Response.json({ ok: true, clientId_konczy_sie: clientId.slice(-30), kontrola: chk });
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
