// TYMCZASOWE WDROŻENIE adminNewsletter (opcja „pomiń osoby w trakcie serii startowej”) — 12.11.2026, na polecenie właściciela („wdrażaj”).
// Autoryzacja: nagłówek X-Exm-Deploy — jednorazowy klucz; w kodzie jest tylko jego skrót SHA-256.
// Bez klucza → 401. Po wdrożeniu funkcja wraca do 410.
// Projekt Supabase: fqhvxhnbeyvwubpnuzxe. Kod funkcji z GitHub Cobiozo/exmortis @ COMMIT, sprawdzany SHA-256.
// Odpowiedzi bez danych osobowych i bez wartości kluczy.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql } from "../../shared/supabase.ts";

const COMMIT = "a03de30f76072179d5160685b716009e294a52d1";
const MANIFEST: { files: Record<string, string>; fn: Record<string, string[]> } = {"files": {"supabase/functions/_shared/compat.ts": "f5d78d8f8624e1ffab986f8c6ee7e0157ccc0cdc271e09d7f121a1d5272931b6", "supabase/functions/_shared/emailLayout.ts": "9840b603d0ba6c66ee28f034a57cbb189e5e27327a155c9ee6503a25988dabaa", "supabase/functions/_shared/libraryAccess.ts": "d619471cbae070fd3a5a26e63d309dd6519861d5323df3ca932442770a647557", "supabase/functions/_shared/newsletterSeries.ts": "3e64a783971dc1f366ddfc7828cca232f547c349bd226acc28fff43ba6c9a324", "supabase/functions/_shared/settings.ts": "5741fa2ae6adf8672d02f69e3b11e79e4b659e74e4729e7ba3c3fa03a59976d7", "supabase/functions/_shared/shim.ts": "1d1a6916eef8a54dbd38bd71bd5a9d007a021ba357dfe69d1b52127bc2f3d63c", "supabase/functions/_shared/smtp.ts": "4e77bc83038981beb68f9169490dc51bba6491f75d2185225da254965e90c66e", "supabase/functions/_shared/snapshot.ts": "c5ea0485874fd261422c66793dea3fa45e9b2b5771f69a2cb9c86dea78aeb641", "supabase/functions/_shared/supabase.ts": "896af9a9e6da10f303a2e22a2f914c44547680ee7da0a934284d6f60fc84dc76", "supabase/functions/adminNewsletter/index.ts": "314e2aba07240919f98d46799f663e50185fce66ab68b81a43d481be0c322a1f"}, "fn": {"adminNewsletter": ["supabase/functions/_shared/compat.ts", "supabase/functions/_shared/emailLayout.ts", "supabase/functions/_shared/libraryAccess.ts", "supabase/functions/_shared/newsletterSeries.ts", "supabase/functions/_shared/settings.ts", "supabase/functions/_shared/shim.ts", "supabase/functions/_shared/smtp.ts", "supabase/functions/_shared/snapshot.ts", "supabase/functions/_shared/supabase.ts", "supabase/functions/adminNewsletter/index.ts"]}};
const KEY_SHA = "b894ff4780a668c4c17931d8933420a143aa8a44fd8e364ec422ff383136475d";
const REF = "fqhvxhnbeyvwubpnuzxe";
const API = `https://api.supabase.com/v1/projects/${REF}`;
const RAW = `https://raw.githubusercontent.com/Cobiozo/exmortis/${COMMIT}/`;

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const sha256 = async (s: string | Uint8Array) => hex(await crypto.subtle.digest("SHA-256", typeof s === "string" ? new TextEncoder().encode(s) : s));
const redact = (s: unknown) => String(s ?? "")
  .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[JWT]")
  .replace(/(bearer\s+)[\w.\-]+/gi, "$1[UKRYTE]")
  .replace(/("?(apikey|authorization|access_token|client_secret|token|secret)"?\s*[:=]\s*"?)[^"',\s)]+/gi, "$1[UKRYTE]")
  .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[e-mail]");

async function mgmt(token: string, path: string, init: RequestInit = {}) {
  const r = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) }, signal: AbortSignal.timeout(90000) });
  const t = await r.text();
  let j: unknown = null; try { j = JSON.parse(t); } catch { j = t.slice(0, 500); }
  return { status: r.status, ok: r.ok, body: j };
}

const cache = new Map<string, string>();
async function fileText(p: string) {
  if (cache.has(p)) return cache.get(p)!;
  const r = await fetch(RAW + p, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${p}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  const h = await sha256(buf);
  if (h !== MANIFEST.files[p]) throw new Error(`Niezgodny SHA-256: ${p}`);
  const t = new TextDecoder().decode(buf);
  cache.set(p, t);
  return t;
}


Deno.serve(async (req) => {
  const key = req.headers.get("x-exm-deploy") || "";
  if (!key || (await sha256(key)) !== KEY_SHA) return Response.json({ error: "Brak autoryzacji" }, { status: 401 });
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  try {
    const { accessToken } = await base44.asServiceRole.connectors.getConnection("supabase");
    if (action === "sql_ro") return Response.json({ rows: await runSql(base44, String(body.q || ""), true) });
    if (action === "logs") {
      // Logi brzegowe funkcji (bez treści i parametrów zapytań): czas, metoda, status HTTP.
      const fn = String(body.fn || "payuNotification").replace(/[^A-Za-z]/g, "");
      const sql = `select timestamp, request.method as method, response.status_code as status, request.url as url from function_edge_logs
        cross join unnest(metadata) as m cross join unnest(m.response) as response cross join unnest(m.request) as request
        where request.url like '%/${fn}%' order by timestamp desc limit 60`;
      const end = new Date(); const start = new Date(end.getTime() - Number(body.hours || 48) * 3600e3);
      const r = await mgmt(accessToken, `/analytics/endpoints/logs.all?sql=${encodeURIComponent(sql)}&iso_timestamp_start=${start.toISOString()}&iso_timestamp_end=${end.toISOString()}`);
      const rows = (r.body as any)?.result;
      return Response.json({ status: r.status, rows: Array.isArray(rows) ? rows.map((x: any) => ({ t: new Date(Number(x.timestamp) / 1000).toISOString(), m: x.method, s: x.status, u: String(x.url || "").split("?")[0].replace(/^https?:\/\/[^/]+/, "") })) : redact(JSON.stringify(r.body)).slice(0, 500) });
    }
    if (action === "functions") {
      const r = await mgmt(accessToken, "/functions");
      const want = new Set<string>(body.slugs || Object.keys(MANIFEST.fn));
      const list = Array.isArray(r.body) ? (r.body as any[]).filter((f) => want.has(f.slug)).map((f) => ({ slug: f.slug, version: f.version, verify_jwt: f.verify_jwt, status: f.status, updated: new Date(f.updated_at).toISOString(), ezbr: String(f.ezbr_sha256 || "").slice(0, 12) })) : r;
      return Response.json({ status: r.status, total: Array.isArray(r.body) ? (r.body as any[]).length : null, list });
    }

    if (action === "deploy") {
      const slugs: string[] = body.slugs || [];
      const out: unknown[] = [];
      for (const slug of slugs) {
        const files = MANIFEST.fn[slug];
        if (!files) { out.push({ slug, blad: "brak w manifeście" }); continue; }
        const cur = await mgmt(accessToken, `/functions/${slug}`);
        if (!cur.ok) { out.push({ slug, blad: `odczyt ${cur.status}`, body: redact(JSON.stringify(cur.body)).slice(0, 300) }); break; }
        const verifyJwt = (cur.body as any).verify_jwt;
        const fd = new FormData();
        fd.append("metadata", JSON.stringify({ entrypoint_path: `supabase/functions/${slug}/index.ts`, name: slug, verify_jwt: verifyJwt }));
        for (const p of files) fd.append("file", new Blob([await fileText(p)], { type: "application/typescript" }), p);
        const r = await mgmt(accessToken, `/functions/deploy?slug=${encodeURIComponent(slug)}`, { method: "POST", body: fd });
        const b: any = r.body;
        const res = { slug, status: r.status, przed: (cur.body as any).version, po: b?.version, verify_jwt_przed: verifyJwt, verify_jwt_po: b?.verify_jwt, pliki: files.length, blad: r.ok ? undefined : redact(JSON.stringify(b)).slice(0, 500) };
        out.push(res);
        if (!r.ok || b?.verify_jwt !== verifyJwt) break; // nie kontynuuj po błędzie
      }
      return Response.json({ commit: COMMIT, wyniki: out });
    }

    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: redact((e as Error)?.message || e).slice(0, 500) }, { status: 500 });
  }
});
