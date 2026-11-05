// TYMCZASOWE WDROŻENIE PayU — 5.11.2026, na polecenie właściciela (pełne wdrożenie produkcyjne).
// Autoryzacja: nagłówek X-Exm-Deploy — jednorazowy klucz; w kodzie jest tylko jego skrót SHA-256.
// Bez klucza → 401, bez żadnego zapytania. Po wdrożeniu funkcja wraca do 410.
// Projekt Supabase: fqhvxhnbeyvwubpnuzxe (Exmortis). Kod funkcji i migracja z GitHub Cobiozo/exmortis @ COMMIT (pełny SHA commita).
// Odpowiedzi bez danych osobowych i bez wartości kluczy.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, serviceKey } from "../../shared/supabase.ts";
const COMMIT = "046316db943056bb67a588118773c751c7a0e7e4";
const MIGRATION_PATH = "docs/tech/migracje/2026-11-05_payu.sql";
const MIGRATION_MD5 = "2bbd75716b6847c975399754a3f82872";
// Liczba plików każdej funkcji (wynik esbuild --metafile na tym samym commicie) — kontrola rozwiązywania importów.
const EXPECTED: Record<string, number> = {"payuNotification":26,"payuCreateOrder":29,"orderFree":15,"checkDiscount":6,"adminSettings":13,"adminOrders":25,"adminClients":11,"adminDashboard":10,"adminProducts":13,"announcements":5,"course":14,"emailChange":12,"eventShare":10,"eventsAdmin":10,"eventsCancel":10,"eventsPublic":22,"gdprPerson":6,"myAccount":10,"myEvents":14,"mySettings":15,"notifications":16,"replicateOne":8,"shopProducts":9,"subscribeNewsletter":17,"tickets":9,"ticketsAdmin":10,"cronTick":17,"cmsScheduled":29};

const KEY_SHA = "bc95d2e15bf41bc4361657ce58ce51ddd07da0bf78ae3d84461be30d7a80df03";
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

async function md5hex(s: string) {
  // Deno: MD5 przez node:crypto.
  const { createHash } = await import("node:crypto");
  return createHash("md5").update(s, "utf8").digest("hex");
}

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
  const t = await r.text();
  cache.set(p, t);
  return t;
}

// Pliki funkcji: index.ts + rekurencyjnie wszystkie importy względne (statyczne i dynamiczne z literałem).
const IMPORT_RE = /(?:\bfrom\s*|\bimport\s*\(?\s*)["'](\.{1,2}\/[^"']+)["']/g;
function join(dir: string, rel: string) {
  const parts = dir.split("/");
  for (const seg of rel.split("/")) { if (seg === "..") parts.pop(); else if (seg !== ".") parts.push(seg); }
  return parts.join("/");
}
async function collect(slug: string) {
  const seen = new Set<string>();
  const queue = [`supabase/functions/${slug}/index.ts`];
  while (queue.length) {
    const p = queue.shift()!;
    if (seen.has(p)) continue;
    seen.add(p);
    const src = await fileText(p);
    const dir = p.slice(0, p.lastIndexOf("/"));
    for (const m of src.matchAll(IMPORT_RE)) queue.push(join(dir, m[1]));
  }
  for (const p of seen) if (!p.startsWith("supabase/functions/")) throw new Error(`Import poza katalogiem funkcji: ${p}`);
  return [...seen].sort();
}

async function payuSettings(base44) {
  const [row] = await runSql(base44, `SELECT value FROM public.app_settings WHERE key='payu'`, true);
  return row?.value || {};
}
const payuBase = (env: string) => env === "sandbox" ? "https://secure.snd.payu.com" : "https://secure.payu.com";
async function payuOAuth(p: any) {
  const r = await fetch(`${payuBase(p.env)}/pl/standard/user/oauth/authorize`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: String(p.clientId || ""), client_secret: String(p.clientSecret || "") }).toString(),
    redirect: "manual", signal: AbortSignal.timeout(15000),
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, token: j?.access_token as string | undefined, expires_in: j?.expires_in, grant_type: j?.grant_type, error: j?.error };
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

    if (action === "migrate") {
      const MIGRATION_SQL = await fileText(MIGRATION_PATH);
      if ((await md5hex(MIGRATION_SQL)) !== MIGRATION_MD5) throw new Error("Migracja: niezgodna suma MD5");
      const t0 = Date.now();
      await runSql(base44, MIGRATION_SQL, false);
      return Response.json({ ok: true, md5: MIGRATION_MD5, ms: Date.now() - t0 });
    }

    if (action === "reserve_test") {
      // Tak jak backend: exm_exec_sql przez PostgREST z kluczem service_role (zapytanie SELECT → read_only=true).
      const k = await serviceKey(base44);
      const rpc = async (q: string, ro: boolean) => {
        const r = await fetch(`https://${REF}.supabase.co/rest/v1/rpc/exm_exec_sql`, {
          method: "POST", headers: { apikey: k, Authorization: `Bearer ${k}`, "Content-Type": "application/json" },
          body: JSON.stringify({ q, read_only: ro }), signal: AbortSignal.timeout(15000),
        });
        return { status: r.status, body: await r.json().catch(() => null) };
      };
      const code = "EXMTEST-WDROZENIE-20261105";
      const a = await rpc(`SELECT public.exm_reserve_code('${code}', 'exmtest-a', 'a@test.invalid', 1) AS ok`, true);
      const b = await rpc(`SELECT public.exm_reserve_code('${code}', 'exmtest-b', 'b@test.invalid', 1) AS ok`, true);
      const n = await rpc(`SELECT count(*)::int AS n FROM public.discount_reservations WHERE code = '${code}'`, true);
      const cleanup = await runSql(base44, `DELETE FROM public.discount_reservations WHERE code = '${code}' AND order_id IN ('exmtest-a','exmtest-b') RETURNING order_id`, false);
      const anon = await fetch(`https://${REF}.supabase.co/rest/v1/rpc/exm_reserve_code`, {
        method: "POST", headers: { apikey: String(body.anon || ""), Authorization: `Bearer ${String(body.anon || "")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_code: code, p_order: "x", p_email: "x", p_free: 1 }),
      }).then(async (r) => ({ status: r.status, body: (await r.text()).slice(0, 200) }));
      return Response.json({ pierwsza: a, druga_inna_osoba: b, rezerwacje: n, usuniete_testowe: cleanup, anon_rpc: anon });
    }

    if (action === "functions") {
      const r = await mgmt(accessToken, "/functions");
      const want = new Set<string>(body.slugs || Object.keys(EXPECTED));
      const list = Array.isArray(r.body) ? (r.body as any[]).filter((f) => want.has(f.slug)).map((f) => ({ slug: f.slug, version: f.version, verify_jwt: f.verify_jwt, status: f.status, updated: new Date(f.updated_at).toISOString(), ezbr: String(f.ezbr_sha256 || "").slice(0, 12) })) : r;
      return Response.json({ status: r.status, total: Array.isArray(r.body) ? (r.body as any[]).length : null, list });
    }

    if (action === "deploy") {
      const slugs: string[] = body.slugs || [];
      const out: unknown[] = [];
      for (const slug of slugs) {
        if (!EXPECTED[slug]) { out.push({ slug, blad: "funkcja spoza listy" }); break; }
        const files = await collect(slug);
        if (files.length !== EXPECTED[slug]) { out.push({ slug, blad: `pliki ${files.length} ≠ oczekiwane ${EXPECTED[slug]}`, files }); break; }
        if (body.dry) { out.push({ slug, pliki: files.length, ok: true }); continue; }
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

    if (action === "payu_oauth") {
      const p = await payuSettings(base44);
      const o = await payuOAuth(p);
      return Response.json({ env: p.env || null, pos_cyfry: /^\d+$/.test(String(p.posId || "")), status: o.status, token_otrzymany: !!o.token, expires_in: o.expires_in, grant_type: o.grant_type, error: o.error || null });
    }

    if (action === "payu_order" || action === "payu_cancel") {
      const id = String(body.payuOrderId || "");
      if (!/^[A-Z0-9]{10,40}$/i.test(id)) throw new Error("Zły numer PayU");
      // Tylko zamówienia testowe (konto +test) — anulowanie dowolnego innego jest zablokowane.
      const [o] = await runSql(base44, `SELECT id, buyer_email ILIKE '%+test%' AS testowe, status, payu_status, is_test, total FROM public.orders WHERE payu_order_id = '${id.replace(/'/g, "")}'`, true);
      if (!o || !o.testowe) throw new Error("To nie jest zamówienie testowe");
      const p = await payuSettings(base44);
      const { token } = await payuOAuth(p);
      if (!token) throw new Error("OAuth PayU nieudany");
      const r = await fetch(`${payuBase(p.env)}/api/v2_1/orders/${id}`, { method: action === "payu_cancel" ? "DELETE" : "GET", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
      const j: any = await r.json().catch(() => ({}));
      const po = j?.orders?.[0] || j?.order || {};
      return Response.json({ http: r.status, status_payu: j?.status?.statusCode, zamowienie: { status: po.status, totalAmount: po.totalAmount, currencyCode: po.currencyCode, merchantPosId_zgodny: po.merchantPosId ? String(po.merchantPosId) === String(p.posId) : null, extOrderId_zgodny: po.extOrderId ? po.extOrderId === o.id : null, notifyUrl: po.notifyUrl || null }, baza: { status: o.status, payu_status: o.payu_status, is_test: o.is_test, total: o.total } });
    }

    if (action === "signed_notify") {
      // Syntetyczne powiadomienie w formacie PayU, podpisane drugim kluczem po stronie serwera (klucz nie opuszcza funkcji),
      // wysłane tą samą drogą co PayU: https://exmortis.pl/functions/payuNotification (proxy CyberFolks → Supabase).
      // Tylko zamówienia testowe (konto +test, is_test) i tylko status zgodny z PayU (sprawdzany w API przed wysłaniem).
      const id = String(body.payuOrderId || "");
      if (!/^[A-Z0-9]{10,40}$/i.test(id)) throw new Error("Zły numer PayU");
      const [o] = await runSql(base44, `SELECT id, buyer_email ILIKE '%+test%' AS testowe, is_test, total FROM public.orders WHERE payu_order_id = '${id.replace(/'/g, "")}'`, true);
      if (!o || !o.testowe || o.is_test !== true) throw new Error("To nie jest zamówienie testowe");
      const p = await payuSettings(base44);
      const { token } = await payuOAuth(p);
      const g = await fetch(`${payuBase(p.env)}/api/v2_1/orders/${id}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) }).then((r) => r.json());
      const po = g?.orders?.[0];
      if (!po) throw new Error("Brak zamówienia w PayU");
      const raw = JSON.stringify({ order: { orderId: po.orderId, extOrderId: po.extOrderId, orderCreateDate: po.orderCreateDate, notifyUrl: po.notifyUrl, customerIp: po.customerIp, merchantPosId: po.merchantPosId, description: po.description, currencyCode: po.currencyCode, totalAmount: po.totalAmount, status: po.status, products: po.products }, localReceiptDateTime: new Date().toISOString(), properties: [{ name: "PAYMENT_ID", value: "TEST" }] });
      const sig = await md5hex(raw + String(p.secondKey || ""));
      const send = async () => {
        const r = await fetch("https://exmortis.pl/functions/payuNotification", { method: "POST", headers: { "Content-Type": "application/json;charset=UTF-8", "OpenPayu-Signature": `sender=checkout;signature=${sig};algorithm=MD5;content=DOCUMENT` }, body: raw, signal: AbortSignal.timeout(30000) });
        return { http: r.status, odpowiedz: redact((await r.text()).slice(0, 300)) };
      };
      const first = await send();
      const second = await send();
      return Response.json({ status_w_payu: po.status, pierwsze: first, duplikat: second });
    }

    if (action === "mark_test") {
      const id = String(body.id || "").replace(/'/g, "");
      const rows = await runSql(base44, `UPDATE public.orders SET is_test = true, fulfill_review = 'TEST — zamówienie kontrolne wdrożenia 5.11.2026' WHERE id = '${id}' AND buyer_email ILIKE '%+test%' AND status IN ('CREATING','PENDING','NEW') RETURNING id, status, is_test`, false);
      return Response.json({ rows });
    }

    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: redact((e as Error)?.message || e).slice(0, 500) }, { status: 500 });
  }
});
