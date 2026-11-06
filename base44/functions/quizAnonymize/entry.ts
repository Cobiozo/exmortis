// TYMCZASOWE WDROŻENIE PayU (odbiór płatności + tytuł transakcji) — 6.11.2026, na polecenie właściciela („wdrażaj”).
// Autoryzacja: nagłówek X-Exm-Deploy — jednorazowy klucz; w kodzie jest tylko jego skrót SHA-256.
// Bez klucza → 401. Po wdrożeniu funkcja wraca do 410.
// Projekt Supabase: fqhvxhnbeyvwubpnuzxe. Kod funkcji z GitHub Cobiozo/exmortis @ COMMIT, sprawdzany SHA-256.
// Odpowiedzi bez danych osobowych i bez wartości kluczy.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql } from "../../shared/supabase.ts";

const COMMIT = "abe1503e032cf9bf09062e1f1a42f282ce1b10a4";
const MANIFEST: { files: Record<string, string>; fn: Record<string, string[]> } = {"files": {"supabase/functions/_shared/access.ts": "737b84b6df8b79d91e086c715b83a96090205251970c7a96a40ead18630d131b", "supabase/functions/_shared/booking.ts": "0f21468143f8bf394d4a600aace75d18e1a743c4254fca163d15835583a3b2fc", "supabase/functions/_shared/bookingCrypto.ts": "2d955ac5b9fecac150671c0b0d845f31761f3f7cee273cdbcb67478a91506a15", "supabase/functions/_shared/bundles.ts": "1d7e6eba44cdc0eecbb65afcf72f948b961191ea2d7505e032b70b57f977cccf", "supabase/functions/_shared/compat.ts": "f5d78d8f8624e1ffab986f8c6ee7e0157ccc0cdc271e09d7f121a1d5272931b6", "supabase/functions/_shared/discounts.ts": "4bd2e92ec3a7337bcaab2690cf8309fd97bdc7b9a4f8a2906b9cf034a3b6499a", "supabase/functions/_shared/emailLayout.ts": "3b6d826da8952133b124b7989abba36e24a9dbb0340859e57ba8f71de030d6cc", "supabase/functions/_shared/fulfillOrder.ts": "2a95e616e4af721e7628b70a3a6787bc3141bd3ad0adc691779131506c6e52e7", "supabase/functions/_shared/giftCard.ts": "bb40315d0e06324e1554f6b2dd2b9c43e2bec1a72a79e5e59791fa32ba73e226", "supabase/functions/_shared/invoices.ts": "87b52966f71a5d865c0205fdb5ceac3adfcfae02a1db55d899a7472f303e4d09", "supabase/functions/_shared/legalDocs.ts": "9a43682cda9dea130c12ba92ef0608b1852789779f4850171c9a8706cd180d1b", "supabase/functions/_shared/libraryAccess.ts": "d619471cbae070fd3a5a26e63d309dd6519861d5323df3ca932442770a647557", "supabase/functions/_shared/mirror.ts": "b65e1419e3341fb805238621733934745090ec80d9acbc0e6c13bdb4c3a20730", "supabase/functions/_shared/nextStep.ts": "1cb88a0c66711a046c43a2af279ca30b8b03c18f3268f7a38b096c1a646c6b04", "supabase/functions/_shared/orders.ts": "d995edf4dd9b954591a0f9b5bf3ef8aad121fd43f20e2cdd083d49420def4301", "supabase/functions/_shared/payu.ts": "4fc702cd48be0791b42c37403efdd1965b982ae7c1f8831543b1f4e74bbfefb5", "supabase/functions/_shared/payuQueue.ts": "b5c4b0b115fb56730acc6ba60ae1b968eefe21f019eb28ae7afa27ff14b1a556", "supabase/functions/_shared/productPrice.ts": "090801d8635165ce89b6ea2bd2021bb8064b40e3575f662f41fcdb5d34af8f1d", "supabase/functions/_shared/refunds.ts": "15728d75b1bb7ac5d6be74da35f6932064b42974978c8de674f789230c50c28e", "supabase/functions/_shared/settings.ts": "5741fa2ae6adf8672d02f69e3b11e79e4b659e74e4729e7ba3c3fa03a59976d7", "supabase/functions/_shared/shim.ts": "1d1a6916eef8a54dbd38bd71bd5a9d007a021ba357dfe69d1b52127bc2f3d63c", "supabase/functions/_shared/smtp.ts": "4e77bc83038981beb68f9169490dc51bba6491f75d2185225da254965e90c66e", "supabase/functions/_shared/snapshot.ts": "c5ea0485874fd261422c66793dea3fa45e9b2b5771f69a2cb9c86dea78aeb641", "supabase/functions/_shared/supabase.ts": "896af9a9e6da10f303a2e22a2f914c44547680ee7da0a934284d6f60fc84dc76", "supabase/functions/_shared/tickets.ts": "21c478c7eed6b3c06a61ae30b968ecfd7198711e80f6b14b7f1ebca6d1c2b600", "supabase/functions/payuNotification/index.ts": "bcac30122abf2718eb0ab510e7951d78080cb09077c7528552584339a60d32e0", "supabase/functions/_shared/errors.ts": "00e658023f0c15251944f18ec454cb86c264d493090028f5b240561169e5f94e", "supabase/functions/_shared/invoice.ts": "a9f2e23bb705b8418fa638a403f92fdbac5a8d60a7288ca96c845a00f9ba0d12", "supabase/functions/_shared/newsletter.ts": "6c894a37b7e64e15edbe75f1bc84b33417cd0c1d07d865bf53663d107c812417", "supabase/functions/_shared/rateLimit.ts": "807a3572e07a2a22945abad56a870296b3bd58cf906ccb7eeea1b3f37da6db22", "supabase/functions/_shared/seats.ts": "6c4ef6be8794edd1123eb76e49ecc68b1d2ff22e754560e06c708275f920496b", "supabase/functions/payuCreateOrder/index.ts": "15804ab3c4bd61bb0f9d370392f34d00e4938170ba490dea36b4e20eb173ab74", "supabase/functions/adminOrders/index.ts": "4199ddf1dfa80680c62850a91d512dbbe54cb6266b747f37ac7c07838498d6b1", "supabase/functions/_shared/bookingSchema.ts": "007fbeed73cbf344c401b190cc3ddb3e087e340405c5ee099eecdbca2fcff319", "supabase/functions/_shared/dataPatches.ts": "dd850f2d044afa13bccba97adbe8afe0ef359a2d95b8150487cd5a5b47b0bd4b", "supabase/functions/_shared/unpaidReminder.ts": "483398b912d038fd5d7ee09f3bd33555e3a0a6319d7287ed261be31b149db6da", "supabase/functions/_shared/waitlist.ts": "5247c6c2043d7cd3c959c1c8a35811a9caeea18c0786071704dbe8b7e8214193", "supabase/functions/cmsScheduled/index.ts": "5953d9af58092abcfa715be1e2a2adfaad006f73e867989d6d84f6f52b1d695d"}, "fn": {"payuNotification": ["supabase/functions/_shared/access.ts", "supabase/functions/_shared/booking.ts", "supabase/functions/_shared/bookingCrypto.ts", "supabase/functions/_shared/bundles.ts", "supabase/functions/_shared/compat.ts", "supabase/functions/_shared/discounts.ts", "supabase/functions/_shared/emailLayout.ts", "supabase/functions/_shared/fulfillOrder.ts", "supabase/functions/_shared/giftCard.ts", "supabase/functions/_shared/invoices.ts", "supabase/functions/_shared/legalDocs.ts", "supabase/functions/_shared/libraryAccess.ts", "supabase/functions/_shared/mirror.ts", "supabase/functions/_shared/nextStep.ts", "supabase/functions/_shared/orders.ts", "supabase/functions/_shared/payu.ts", "supabase/functions/_shared/payuQueue.ts", "supabase/functions/_shared/productPrice.ts", "supabase/functions/_shared/refunds.ts", "supabase/functions/_shared/settings.ts", "supabase/functions/_shared/shim.ts", "supabase/functions/_shared/smtp.ts", "supabase/functions/_shared/snapshot.ts", "supabase/functions/_shared/supabase.ts", "supabase/functions/_shared/tickets.ts", "supabase/functions/payuNotification/index.ts"], "payuCreateOrder": ["supabase/functions/_shared/access.ts", "supabase/functions/_shared/booking.ts", "supabase/functions/_shared/bookingCrypto.ts", "supabase/functions/_shared/bundles.ts", "supabase/functions/_shared/compat.ts", "supabase/functions/_shared/discounts.ts", "supabase/functions/_shared/emailLayout.ts", "supabase/functions/_shared/errors.ts", "supabase/functions/_shared/fulfillOrder.ts", "supabase/functions/_shared/giftCard.ts", "supabase/functions/_shared/invoice.ts", "supabase/functions/_shared/invoices.ts", "supabase/functions/_shared/legalDocs.ts", "supabase/functions/_shared/mirror.ts", "supabase/functions/_shared/newsletter.ts", "supabase/functions/_shared/nextStep.ts", "supabase/functions/_shared/orders.ts", "supabase/functions/_shared/payu.ts", "supabase/functions/_shared/payuQueue.ts", "supabase/functions/_shared/productPrice.ts", "supabase/functions/_shared/rateLimit.ts", "supabase/functions/_shared/seats.ts", "supabase/functions/_shared/settings.ts", "supabase/functions/_shared/shim.ts", "supabase/functions/_shared/smtp.ts", "supabase/functions/_shared/snapshot.ts", "supabase/functions/_shared/supabase.ts", "supabase/functions/_shared/tickets.ts", "supabase/functions/payuCreateOrder/index.ts"], "adminOrders": ["supabase/functions/_shared/access.ts", "supabase/functions/_shared/booking.ts", "supabase/functions/_shared/bookingCrypto.ts", "supabase/functions/_shared/bundles.ts", "supabase/functions/_shared/compat.ts", "supabase/functions/_shared/discounts.ts", "supabase/functions/_shared/emailLayout.ts", "supabase/functions/_shared/fulfillOrder.ts", "supabase/functions/_shared/giftCard.ts", "supabase/functions/_shared/invoices.ts", "supabase/functions/_shared/legalDocs.ts", "supabase/functions/_shared/mirror.ts", "supabase/functions/_shared/nextStep.ts", "supabase/functions/_shared/orders.ts", "supabase/functions/_shared/payu.ts", "supabase/functions/_shared/payuQueue.ts", "supabase/functions/_shared/productPrice.ts", "supabase/functions/_shared/refunds.ts", "supabase/functions/_shared/settings.ts", "supabase/functions/_shared/shim.ts", "supabase/functions/_shared/smtp.ts", "supabase/functions/_shared/snapshot.ts", "supabase/functions/_shared/supabase.ts", "supabase/functions/_shared/tickets.ts", "supabase/functions/adminOrders/index.ts"], "cmsScheduled": ["supabase/functions/_shared/access.ts", "supabase/functions/_shared/booking.ts", "supabase/functions/_shared/bookingCrypto.ts", "supabase/functions/_shared/bookingSchema.ts", "supabase/functions/_shared/bundles.ts", "supabase/functions/_shared/compat.ts", "supabase/functions/_shared/dataPatches.ts", "supabase/functions/_shared/discounts.ts", "supabase/functions/_shared/emailLayout.ts", "supabase/functions/_shared/fulfillOrder.ts", "supabase/functions/_shared/giftCard.ts", "supabase/functions/_shared/invoices.ts", "supabase/functions/_shared/legalDocs.ts", "supabase/functions/_shared/libraryAccess.ts", "supabase/functions/_shared/mirror.ts", "supabase/functions/_shared/nextStep.ts", "supabase/functions/_shared/orders.ts", "supabase/functions/_shared/payu.ts", "supabase/functions/_shared/payuQueue.ts", "supabase/functions/_shared/productPrice.ts", "supabase/functions/_shared/settings.ts", "supabase/functions/_shared/shim.ts", "supabase/functions/_shared/smtp.ts", "supabase/functions/_shared/snapshot.ts", "supabase/functions/_shared/supabase.ts", "supabase/functions/_shared/tickets.ts", "supabase/functions/_shared/unpaidReminder.ts", "supabase/functions/_shared/waitlist.ts", "supabase/functions/cmsScheduled/index.ts"]}};
const KEY_SHA = "e8ae095ec99dfcd1b38357d4564665fa2497d14dee7eb2d0738231ae995338c0";
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
    if (action === "payu_peek") {
      // Tylko odczyt: stan zamówienia i transakcji w PayU, bez danych kupującego.
      const ids: string[] = (body.ids || []).map((x: string) => String(x).replace(/[^0-9a-f-]/gi, "")).filter(Boolean).slice(0, 5);
      const [p] = await runSql(base44, `SELECT value FROM public.app_settings WHERE key='payu'`, true);
      const payu = p?.value || {};
      const base = payu.env === "sandbox" ? "https://secure.snd.payu.com" : "https://secure.payu.com";
      const tr = await fetch(`${base}/pl/standard/user/oauth/authorize`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "client_credentials", client_id: String(payu.clientId || ""), client_secret: String(payu.clientSecret || "") }).toString() });
      const tok = (await tr.json().catch(() => ({})))?.access_token;
      if (!tok) throw new Error("OAuth PayU nieudany");
      const out: unknown[] = [];
      for (const id of ids) {
        const [o] = await runSql(base44, `SELECT id, payu_order_id, status, payu_status, total FROM public.orders WHERE id LIKE '${id}%' LIMIT 1`, true);
        if (!o) { out.push({ id, blad: "brak" }); continue; }
        const g = await fetch(`${base}/api/v2_1/orders/${encodeURIComponent(o.payu_order_id)}`, { headers: { Authorization: `Bearer ${tok}` } });
        const gj: any = await g.json().catch(() => ({}));
        const po = gj?.orders?.[0] || {};
        const t = await fetch(`${base}/api/v2_1/orders/${encodeURIComponent(o.payu_order_id)}/transactions`, { headers: { Authorization: `Bearer ${tok}` } });
        const tj: any = await t.json().catch(() => ({}));
        out.push({ id: String(o.id).slice(0, 8), baza: { status: o.status, payu_status: o.payu_status, total: o.total }, http: g.status,
          payu: { status: po.status, totalAmount: po.totalAmount, currencyCode: po.currencyCode, pos_zgodny: String(po.merchantPosId) === String(payu.posId), ext_zgodny: po.extOrderId === o.id, payMethod: po.payMethod?.type, notifyUrl: po.notifyUrl, orderCreateDate: po.orderCreateDate, properties: gj?.properties },
          transakcje: { http: t.status, surowe: JSON.stringify(tj).replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[e-mail]").slice(0, 1500) } });
      }
      return Response.json({ wyniki: out });
    }
    if (action === "capture_try") {
      // Odbiór płatności właściciela (zatwierdzony w czacie): tylko przy zgodnej kwocie, walucie, POS i numerze zamówienia.
      const id = String(body.id || "").replace(/[^0-9a-f-]/gi, "");
      const [o] = await runSql(base44, `SELECT id, payu_order_id, status, total FROM public.orders WHERE id LIKE '${id}%' AND status = 'PENDING' LIMIT 1`, true);
      if (!o || !id) throw new Error("brak zamówienia PENDING");
      const [p] = await runSql(base44, `SELECT value FROM public.app_settings WHERE key='payu'`, true);
      const payu = p?.value || {};
      const base = payu.env === "sandbox" ? "https://secure.snd.payu.com" : "https://secure.payu.com";
      const tr = await fetch(`${base}/pl/standard/user/oauth/authorize`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "client_credentials", client_id: String(payu.clientId || ""), client_secret: String(payu.clientSecret || "") }).toString() });
      const tok = (await tr.json().catch(() => ({})))?.access_token;
      if (!tok) throw new Error("OAuth PayU nieudany");
      const pid = encodeURIComponent(o.payu_order_id);
      const g: any = await (await fetch(`${base}/api/v2_1/orders/${pid}`, { headers: { Authorization: `Bearer ${tok}` } })).json().catch(() => ({}));
      const po = g?.orders?.[0] || {};
      const ok = String(po.totalAmount) === String(Math.round(Number(o.total) * 100)) && po.currencyCode === "PLN" && String(po.merchantPosId) === String(payu.posId) && po.extOrderId === o.id;
      if (!ok) return Response.json({ odmowa: "niezgodna płatność", status: po.status });
      const h = { Authorization: `Bearer ${tok}`, "Content-Type": "application/json", Accept: "application/json" };
      const r1 = await fetch(`${base}/api/v2_1/orders/${pid}/status`, { method: "PUT", headers: h, body: JSON.stringify({ orderId: o.payu_order_id, orderStatus: "COMPLETED" }) });
      const b1 = (await r1.text()).slice(0, 400);
      let r2s = null, b2 = null;
      if (!r1.ok) { const r2 = await fetch(`${base}/api/v2_1/orders/${pid}/captures`, { method: "POST", headers: h, body: "{}" }); r2s = r2.status; b2 = (await r2.text()).slice(0, 400); }
      const after: any = await (await fetch(`${base}/api/v2_1/orders/${pid}`, { headers: { Authorization: `Bearer ${tok}` } })).json().catch(() => ({}));
      return Response.json({ przed: po.status, put_status: r1.status, put_body: b1, captures_status: r2s, captures_body: b2, po: after?.orders?.[0]?.status });
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
