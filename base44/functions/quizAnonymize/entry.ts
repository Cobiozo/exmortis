// TYMCZASOWE WDROŻENIE: kampanie popup (wariant M) + opcje kodów rabatowych — 2 funkcje (moduł Wiadomości: odbiorcy, kody, e-maile) — 17.11.2026, na polecenie właściciela („buduj”).
// Autoryzacja: nagłówek X-Exm-Deploy — jednorazowy klucz; w kodzie jest tylko jego skrót SHA-256.
// Bez klucza → 401. Po wdrożeniu funkcja wraca do 410.
// Projekt Supabase: fqhvxhnbeyvwubpnuzxe. Kod funkcji z GitHub Cobiozo/exmortis @ COMMIT, sprawdzany SHA-256.
// Odpowiedzi bez danych osobowych i bez wartości kluczy.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql } from "../../shared/supabase.ts";

const COMMIT = "bc537492ee61e7701d3289d454f4c835e9d0d982";
const MANIFEST: { files: Record<string, string>; fn: Record<string, string[]> } = {"files": {"supabase/functions/_shared/access.ts": "737b84b6df8b79d91e086c715b83a96090205251970c7a96a40ead18630d131b", "supabase/functions/_shared/compat.ts": "2d8bcaf24033b911c2cfa76fc0409fffaac5eac3256904dc05332c8bf29ed16b", "supabase/functions/_shared/emailLayout.ts": "d5c05662b061a01e5e73a014a8b3b4287e87109a0ff1ded3d7c6111e0e98e6ad", "supabase/functions/_shared/library2bSql.ts": "00e30df8542304662fff8f55f6c8c39e045db934b0b86ab664278bae6366e290", "supabase/functions/_shared/libraryAccess.ts": "d619471cbae070fd3a5a26e63d309dd6519861d5323df3ca932442770a647557", "supabase/functions/_shared/libraryMedia.ts": "cee22e665986712cb1b8678f577558c7aa9cff806d75e334a949bf133ee09565", "supabase/functions/_shared/libraryNotify.ts": "96c51431df2161ecbf6551c96d23c8621e2cdb90e925c8ee5bc0708679728627", "supabase/functions/_shared/libraryRpcSql.ts": "399dc3f5c83e7004da2d9d08ded4cc33334527649238cea4ba61df1c32f61ec9", "supabase/functions/_shared/librarySanitize.ts": "485b4cf4b734837581f1fc3aeb01e42e32aae6cfa56a8fda62709a12de04d5d5", "supabase/functions/_shared/librarySchema.ts": "60cc8dbf4670182f0e0c637a15c8c5db59b8f3044a4bd1326a739a32874c85b1", "supabase/functions/_shared/libraryView.ts": "5f3c787bb9b6220db76a01dcea628ec9f19aa64b8bbe8fbb08dc69e6e6e6e8ff", "supabase/functions/_shared/mirror.ts": "b65e1419e3341fb805238621733934745090ec80d9acbc0e6c13bdb4c3a20730", "supabase/functions/_shared/popup.ts": "e90d4332272e43a696d099e68d3807dd6b44d0f07f888f59fd0b4531108d6a52", "supabase/functions/_shared/productPrice.ts": "090801d8635165ce89b6ea2bd2021bb8064b40e3575f662f41fcdb5d34af8f1d", "supabase/functions/_shared/settings.ts": "5741fa2ae6adf8672d02f69e3b11e79e4b659e74e4729e7ba3c3fa03a59976d7", "supabase/functions/_shared/shim.ts": "1d1a6916eef8a54dbd38bd71bd5a9d007a021ba357dfe69d1b52127bc2f3d63c", "supabase/functions/_shared/smtp.ts": "4e77bc83038981beb68f9169490dc51bba6491f75d2185225da254965e90c66e", "supabase/functions/_shared/snapshot.ts": "c5ea0485874fd261422c66793dea3fa45e9b2b5771f69a2cb9c86dea78aeb641", "supabase/functions/_shared/supabase.ts": "72ca71fb3860420dbdd4041bdbe4e70b149ce06b08072db9f16e029b9b18f82e", "supabase/functions/libraryAdmin/index.ts": "f9c301b9df1399c70a805420038629992cde2eb2e85ef22b324d743d6943e5c3", "supabase/functions/libraryTick/index.ts": "84aed4607eeb6cccbcd38901a62b06d22ba27e3332f5249e2fe8c3e857bd2ed6"}, "fn": {"libraryAdmin": ["supabase/functions/_shared/access.ts", "supabase/functions/_shared/compat.ts", "supabase/functions/_shared/emailLayout.ts", "supabase/functions/_shared/library2bSql.ts", "supabase/functions/_shared/libraryAccess.ts", "supabase/functions/_shared/libraryMedia.ts", "supabase/functions/_shared/libraryNotify.ts", "supabase/functions/_shared/libraryRpcSql.ts", "supabase/functions/_shared/librarySanitize.ts", "supabase/functions/_shared/librarySchema.ts", "supabase/functions/_shared/libraryView.ts", "supabase/functions/_shared/mirror.ts", "supabase/functions/_shared/popup.ts", "supabase/functions/_shared/productPrice.ts", "supabase/functions/_shared/settings.ts", "supabase/functions/_shared/shim.ts", "supabase/functions/_shared/smtp.ts", "supabase/functions/_shared/snapshot.ts", "supabase/functions/_shared/supabase.ts", "supabase/functions/libraryAdmin/index.ts"], "libraryTick": ["supabase/functions/_shared/compat.ts", "supabase/functions/_shared/emailLayout.ts", "supabase/functions/_shared/libraryAccess.ts", "supabase/functions/_shared/libraryNotify.ts", "supabase/functions/_shared/librarySanitize.ts", "supabase/functions/_shared/settings.ts", "supabase/functions/_shared/shim.ts", "supabase/functions/_shared/smtp.ts", "supabase/functions/_shared/snapshot.ts", "supabase/functions/_shared/supabase.ts", "supabase/functions/libraryTick/index.ts"]}};
const KEY_SHA = "e5b4f4c90d7277a27451b078dccad2e355146ef13153c9d7a56e5786557b50d6";
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
        // Nowa funkcja (404): tworzymy ją z verify_jwt = true, jak pozostałe publiczne funkcje.
        if (!cur.ok && cur.status !== 404) { out.push({ slug, blad: `odczyt ${cur.status}`, body: redact(JSON.stringify(cur.body)).slice(0, 300) }); break; }
        const verifyJwt = cur.ok ? (cur.body as any).verify_jwt : true;
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
