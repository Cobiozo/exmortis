// TYMCZASOWE WDROŻENIE (14.11.2026, „dodaj popup”): 5 funkcji Supabase.
// Autoryzacja: nagłówek X-Exm-Deploy — jednorazowy klucz; w kodzie jest tylko jego skrót SHA-256.
// Bez klucza → 401. Po wdrożeniu funkcja wraca do 410.
// Projekt Supabase: fqhvxhnbeyvwubpnuzxe. Kod funkcji z GitHub Cobiozo/exmortis @ COMMIT, sprawdzany SHA-256.
// Odpowiedzi bez danych osobowych i bez wartości kluczy.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql } from "../../shared/supabase.ts";

const COMMIT = "99b91c407c00403c9da3792a1c983e9c7e936604";
const MANIFEST: { files: Record<string, string>; fn: Record<string, string[]> } = {"files": {"supabase/functions/_shared/appOffline.ts": "aca02a8b5d3268bdce116a5b6d27dfd0cd5d5bc9eb717c379c9b26fe15801a32", "supabase/functions/_shared/compat.ts": "f5d78d8f8624e1ffab986f8c6ee7e0157ccc0cdc271e09d7f121a1d5272931b6", "supabase/functions/_shared/firma.ts": "08f1468f17796093da27ca1d2372d811bd1128eaaaefe8fd2f99d038f1ad4af8", "supabase/functions/_shared/invoices.ts": "87b52966f71a5d865c0205fdb5ceac3adfcfae02a1db55d899a7472f303e4d09", "supabase/functions/_shared/legalDocs.ts": "6021a013ab8a08d88fdeeecf166a437c675809f958c12786964165837c874d1a", "supabase/functions/_shared/payu.ts": "2affb0d0f1f16c4b938714b6a9a528f86b3db19212ec96caae3731708cc87e15", "supabase/functions/_shared/popup.ts": "a4ecca4ca7bff3f83cbf2c2ace1431da69a847d23eceb130d861079a35ce36a2", "supabase/functions/_shared/settings.ts": "5741fa2ae6adf8672d02f69e3b11e79e4b659e74e4729e7ba3c3fa03a59976d7", "supabase/functions/_shared/shim.ts": "1d1a6916eef8a54dbd38bd71bd5a9d007a021ba357dfe69d1b52127bc2f3d63c", "supabase/functions/_shared/snapshot.ts": "c5ea0485874fd261422c66793dea3fa45e9b2b5771f69a2cb9c86dea78aeb641", "supabase/functions/_shared/supabase.ts": "896af9a9e6da10f303a2e22a2f914c44547680ee7da0a934284d6f60fc84dc76", "supabase/functions/_shared/tracking.ts": "5a296c1ea917ca84e55c5e8b780a091fd69b02b61092c0d6cde4ad57e5f670ca", "supabase/functions/_shared/videoSign.ts": "3e15cdff42c370a058bdfcd53fc59517dcce3979301077021d491063dc1d0821", "supabase/functions/adminSettings/index.ts": "743865fa1d46fd0f66beee7ff6b2d311499718d08b56f5ed0e2202f61f9f3e6e", "supabase/functions/_shared/publicData.ts": "a14b4b434684c3b83884ea49cb166466d81d2279ec81ad50362f5730e111216c", "supabase/functions/bootstrap/index.ts": "55009ab7c32839715811c28de30f6c8141a87d3e482217cf18402c99778044a9", "supabase/functions/_shared/emailLayout.ts": "9840b603d0ba6c66ee28f034a57cbb189e5e27327a155c9ee6503a25988dabaa", "supabase/functions/_shared/events.ts": "7e2a9b13908e64a9223aa2965bbee010c4870490944318e3474b11d1e78ec50d", "supabase/functions/_shared/followup.ts": "61dea4b8c93adeab51a2e45be02234eb92ede4fe08c37c422f1114f25128e5d4", "supabase/functions/_shared/libraryAccess.ts": "d619471cbae070fd3a5a26e63d309dd6519861d5323df3ca932442770a647557", "supabase/functions/_shared/mirror.ts": "b65e1419e3341fb805238621733934745090ec80d9acbc0e6c13bdb4c3a20730", "supabase/functions/_shared/newsletter.ts": "6c894a37b7e64e15edbe75f1bc84b33417cd0c1d07d865bf53663d107c812417", "supabase/functions/_shared/rateLimit.ts": "807a3572e07a2a22945abad56a870296b3bd58cf906ccb7eeea1b3f37da6db22", "supabase/functions/_shared/registrations.ts": "fa7b5bfc05846b586b999453fbe3c43afa464f9abab9a53aac3d2c1e8372b032", "supabase/functions/_shared/retention.ts": "3079e608dd657e1759a6d87b3b1e11d9c2f3606e73fda17adb8d99752407d18c", "supabase/functions/_shared/smtp.ts": "4e77bc83038981beb68f9169490dc51bba6491f75d2185225da254965e90c66e", "supabase/functions/_shared/tickets.ts": "21c478c7eed6b3c06a61ae30b968ecfd7198711e80f6b14b7f1ebca6d1c2b600", "supabase/functions/eventsPublic/index.ts": "9f2faa14d72eab0a0c498e5a30fddbac6bb91097cdbcc8cde44d8244727e94c4", "supabase/functions/siteContent/index.ts": "53ad4baead627cddb27d6c44ef23456efcd05356ceedd16867e2ef7d610ca0ae", "supabase/functions/siteSettings/index.ts": "6bbf12f7404b0d5e1221905a36786df006f20deb04b5663e625ece3d3afca6dc"}, "fn": {"adminSettings": ["supabase/functions/_shared/appOffline.ts", "supabase/functions/_shared/compat.ts", "supabase/functions/_shared/firma.ts", "supabase/functions/_shared/invoices.ts", "supabase/functions/_shared/legalDocs.ts", "supabase/functions/_shared/payu.ts", "supabase/functions/_shared/popup.ts", "supabase/functions/_shared/settings.ts", "supabase/functions/_shared/shim.ts", "supabase/functions/_shared/snapshot.ts", "supabase/functions/_shared/supabase.ts", "supabase/functions/_shared/tracking.ts", "supabase/functions/_shared/videoSign.ts", "supabase/functions/adminSettings/index.ts"], "bootstrap": ["supabase/functions/_shared/appOffline.ts", "supabase/functions/_shared/compat.ts", "supabase/functions/_shared/firma.ts", "supabase/functions/_shared/legalDocs.ts", "supabase/functions/_shared/popup.ts", "supabase/functions/_shared/publicData.ts", "supabase/functions/_shared/settings.ts", "supabase/functions/_shared/shim.ts", "supabase/functions/_shared/snapshot.ts", "supabase/functions/_shared/supabase.ts", "supabase/functions/_shared/tracking.ts", "supabase/functions/bootstrap/index.ts"], "eventsPublic": ["supabase/functions/_shared/appOffline.ts", "supabase/functions/_shared/compat.ts", "supabase/functions/_shared/emailLayout.ts", "supabase/functions/_shared/events.ts", "supabase/functions/_shared/firma.ts", "supabase/functions/_shared/followup.ts", "supabase/functions/_shared/legalDocs.ts", "supabase/functions/_shared/libraryAccess.ts", "supabase/functions/_shared/mirror.ts", "supabase/functions/_shared/newsletter.ts", "supabase/functions/_shared/popup.ts", "supabase/functions/_shared/publicData.ts", "supabase/functions/_shared/rateLimit.ts", "supabase/functions/_shared/registrations.ts", "supabase/functions/_shared/retention.ts", "supabase/functions/_shared/settings.ts", "supabase/functions/_shared/shim.ts", "supabase/functions/_shared/smtp.ts", "supabase/functions/_shared/snapshot.ts", "supabase/functions/_shared/supabase.ts", "supabase/functions/_shared/tickets.ts", "supabase/functions/_shared/tracking.ts", "supabase/functions/eventsPublic/index.ts"], "siteContent": ["supabase/functions/_shared/appOffline.ts", "supabase/functions/_shared/compat.ts", "supabase/functions/_shared/firma.ts", "supabase/functions/_shared/legalDocs.ts", "supabase/functions/_shared/popup.ts", "supabase/functions/_shared/publicData.ts", "supabase/functions/_shared/settings.ts", "supabase/functions/_shared/shim.ts", "supabase/functions/_shared/snapshot.ts", "supabase/functions/_shared/supabase.ts", "supabase/functions/_shared/tracking.ts", "supabase/functions/siteContent/index.ts"], "siteSettings": ["supabase/functions/_shared/appOffline.ts", "supabase/functions/_shared/compat.ts", "supabase/functions/_shared/firma.ts", "supabase/functions/_shared/legalDocs.ts", "supabase/functions/_shared/popup.ts", "supabase/functions/_shared/publicData.ts", "supabase/functions/_shared/settings.ts", "supabase/functions/_shared/shim.ts", "supabase/functions/_shared/snapshot.ts", "supabase/functions/_shared/supabase.ts", "supabase/functions/_shared/tracking.ts", "supabase/functions/siteSettings/index.ts"]}};
const KEY_SHA = "eeb68b1fa640298c1feac7ce7a104fdfb5dffb452c86b2abc638e30d38032d2f";
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
