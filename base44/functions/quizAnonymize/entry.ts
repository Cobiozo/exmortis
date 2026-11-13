// TYMCZASOWE WDROŻENIE (14.11.2026, „wdrażaj”): kod powitalny −20% — 7 funkcji Supabase.
// Autoryzacja: nagłówek X-Exm-Deploy — jednorazowy klucz; w kodzie jest tylko jego skrót SHA-256.
// Bez klucza → 401. Po wdrożeniu funkcja wraca do 410.
// Projekt Supabase: fqhvxhnbeyvwubpnuzxe. Kod funkcji z GitHub Cobiozo/exmortis @ COMMIT, sprawdzany SHA-256.
// Odpowiedzi bez danych osobowych i bez wartości kluczy.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql } from "../../shared/supabase.ts";

const COMMIT = "354be36a05a64076e582aa4fee75c781e43bc158";
const MANIFEST: { files: Record<string, string>; fn: Record<string, string[]> } = {"files": {"supabase/functions/_shared/access.ts": "737b84b6df8b79d91e086c715b83a96090205251970c7a96a40ead18630d131b", "supabase/functions/_shared/booking.ts": "0f21468143f8bf394d4a600aace75d18e1a743c4254fca163d15835583a3b2fc", "supabase/functions/_shared/bookingCrypto.ts": "2d955ac5b9fecac150671c0b0d845f31761f3f7cee273cdbcb67478a91506a15", "supabase/functions/_shared/bookingSchema.ts": "007fbeed73cbf344c401b190cc3ddb3e087e340405c5ee099eecdbca2fcff319", "supabase/functions/_shared/bundles.ts": "1d7e6eba44cdc0eecbb65afcf72f948b961191ea2d7505e032b70b57f977cccf", "supabase/functions/_shared/compat.ts": "f5d78d8f8624e1ffab986f8c6ee7e0157ccc0cdc271e09d7f121a1d5272931b6", "supabase/functions/_shared/dataPatches.ts": "dd850f2d044afa13bccba97adbe8afe0ef359a2d95b8150487cd5a5b47b0bd4b", "supabase/functions/_shared/discounts.ts": "9eb28f0d5720aeeb668abf1fb020ebaa54506f5b834db98ae0f941b80f01e1dc", "supabase/functions/_shared/emailLayout.ts": "9840b603d0ba6c66ee28f034a57cbb189e5e27327a155c9ee6503a25988dabaa", "supabase/functions/_shared/fulfillOrder.ts": "170841927f8eb7558b480fe0531e52f2a7be2417cb774403a8d1df48bc42b3a4", "supabase/functions/_shared/giftCard.ts": "bb40315d0e06324e1554f6b2dd2b9c43e2bec1a72a79e5e59791fa32ba73e226", "supabase/functions/_shared/invoices.ts": "87b52966f71a5d865c0205fdb5ceac3adfcfae02a1db55d899a7472f303e4d09", "supabase/functions/_shared/legalDocs.ts": "6021a013ab8a08d88fdeeecf166a437c675809f958c12786964165837c874d1a", "supabase/functions/_shared/libraryAccess.ts": "d619471cbae070fd3a5a26e63d309dd6519861d5323df3ca932442770a647557", "supabase/functions/_shared/mirror.ts": "b65e1419e3341fb805238621733934745090ec80d9acbc0e6c13bdb4c3a20730", "supabase/functions/_shared/nextStep.ts": "1cb88a0c66711a046c43a2af279ca30b8b03c18f3268f7a38b096c1a646c6b04", "supabase/functions/_shared/orders.ts": "d995edf4dd9b954591a0f9b5bf3ef8aad121fd43f20e2cdd083d49420def4301", "supabase/functions/_shared/payu.ts": "2affb0d0f1f16c4b938714b6a9a528f86b3db19212ec96caae3731708cc87e15", "supabase/functions/_shared/payuQueue.ts": "99cbf6e81ad21333520a46083f7fd1b41cd6db9041b1cd33b875406824f91dbd", "supabase/functions/_shared/powrotPay.ts": "95499e9b13f6cbe3d33af8e4af635205f4f4cbc88d62f4d3ae46ca969bf38fc5", "supabase/functions/_shared/productPrice.ts": "090801d8635165ce89b6ea2bd2021bb8064b40e3575f662f41fcdb5d34af8f1d", "supabase/functions/_shared/settings.ts": "5741fa2ae6adf8672d02f69e3b11e79e4b659e74e4729e7ba3c3fa03a59976d7", "supabase/functions/_shared/shim.ts": "1d1a6916eef8a54dbd38bd71bd5a9d007a021ba357dfe69d1b52127bc2f3d63c", "supabase/functions/_shared/smtp.ts": "4e77bc83038981beb68f9169490dc51bba6491f75d2185225da254965e90c66e", "supabase/functions/_shared/snapshot.ts": "c5ea0485874fd261422c66793dea3fa45e9b2b5771f69a2cb9c86dea78aeb641", "supabase/functions/_shared/supabase.ts": "896af9a9e6da10f303a2e22a2f914c44547680ee7da0a934284d6f60fc84dc76", "supabase/functions/_shared/tickets.ts": "21c478c7eed6b3c06a61ae30b968ecfd7198711e80f6b14b7f1ebca6d1c2b600", "supabase/functions/_shared/unpaidReminder.ts": "483398b912d038fd5d7ee09f3bd33555e3a0a6319d7287ed261be31b149db6da", "supabase/functions/_shared/waitlist.ts": "5247c6c2043d7cd3c959c1c8a35811a9caeea18c0786071704dbe8b7e8214193", "supabase/functions/_shared/welcomeCode.ts": "9057a2082aafced213e87638ff38d3a939e6385128d82bcdc5419665d7fb042c", "supabase/functions/cmsScheduled/index.ts": "e680eb2add715795619455ddcab77355ee14c8136412d7888c8abf7894e6633e", "supabase/functions/_shared/errors.ts": "00e658023f0c15251944f18ec454cb86c264d493090028f5b240561169e5f94e", "supabase/functions/checkDiscount/index.ts": "a6616e3de7ab94fc86e763c0396b3d57bd2dd52847ffcf83635ef08d5712e8dd", "supabase/functions/_shared/invoice.ts": "a9f2e23bb705b8418fa638a403f92fdbac5a8d60a7288ca96c845a00f9ba0d12", "supabase/functions/_shared/newsletter.ts": "6c894a37b7e64e15edbe75f1bc84b33417cd0c1d07d865bf53663d107c812417", "supabase/functions/_shared/rateLimit.ts": "807a3572e07a2a22945abad56a870296b3bd58cf906ccb7eeea1b3f37da6db22", "supabase/functions/_shared/seats.ts": "6c4ef6be8794edd1123eb76e49ecc68b1d2ff22e754560e06c708275f920496b", "supabase/functions/payuCreateOrder/index.ts": "8867e30b08105e21448290e2ae81cdc2e58d475cc7eed942782adf07be968d46", "supabase/functions/_shared/refunds.ts": "15728d75b1bb7ac5d6be74da35f6932064b42974978c8de674f789230c50c28e", "supabase/functions/payuNotification/index.ts": "bcac30122abf2718eb0ab510e7951d78080cb09077c7528552584339a60d32e0", "supabase/functions/_shared/announce.ts": "54bd5447770a4137916dc145a2f3fabb7c03bdba64bb29f4268f14e020b15aaf", "supabase/functions/_shared/libraryMedia.ts": "cee22e665986712cb1b8678f577558c7aa9cff806d75e334a949bf133ee09565", "supabase/functions/_shared/libraryNotify.ts": "a90f64d985034a1a23549bbc697840080e868908fb42222d6c630241f35eb582", "supabase/functions/_shared/librarySanitize.ts": "485b4cf4b734837581f1fc3aeb01e42e32aae6cfa56a8fda62709a12de04d5d5", "supabase/functions/_shared/libraryView.ts": "5f3c787bb9b6220db76a01dcea628ec9f19aa64b8bbe8fbb08dc69e6e6e6e8ff", "supabase/functions/notifications/index.ts": "87c157ba37e14f3bdc335089803d64c8fb3ebcfaf559767c6c7d9889e51a61b4", "supabase/functions/_shared/appOffline.ts": "aca02a8b5d3268bdce116a5b6d27dfd0cd5d5bc9eb717c379c9b26fe15801a32", "supabase/functions/_shared/firma.ts": "08f1468f17796093da27ca1d2372d811bd1128eaaaefe8fd2f99d038f1ad4af8", "supabase/functions/_shared/popup.ts": "a4ecca4ca7bff3f83cbf2c2ace1431da69a847d23eceb130d861079a35ce36a2", "supabase/functions/_shared/tracking.ts": "5a296c1ea917ca84e55c5e8b780a091fd69b02b61092c0d6cde4ad57e5f670ca", "supabase/functions/_shared/videoSign.ts": "3e15cdff42c370a058bdfcd53fc59517dcce3979301077021d491063dc1d0821", "supabase/functions/adminSettings/index.ts": "e899e1d2c5a09474a85bc827e7461585760dae65d185890f2c854c42e2c46a54", "supabase/functions/adminOrders/index.ts": "20cd2e06d7de7d075f4cac7d33be58fafd0a759543ef05ea1840fc7bb7d12bf8"}, "fn": {"cmsScheduled": ["supabase/functions/_shared/access.ts", "supabase/functions/_shared/booking.ts", "supabase/functions/_shared/bookingCrypto.ts", "supabase/functions/_shared/bookingSchema.ts", "supabase/functions/_shared/bundles.ts", "supabase/functions/_shared/compat.ts", "supabase/functions/_shared/dataPatches.ts", "supabase/functions/_shared/discounts.ts", "supabase/functions/_shared/emailLayout.ts", "supabase/functions/_shared/fulfillOrder.ts", "supabase/functions/_shared/giftCard.ts", "supabase/functions/_shared/invoices.ts", "supabase/functions/_shared/legalDocs.ts", "supabase/functions/_shared/libraryAccess.ts", "supabase/functions/_shared/mirror.ts", "supabase/functions/_shared/nextStep.ts", "supabase/functions/_shared/orders.ts", "supabase/functions/_shared/payu.ts", "supabase/functions/_shared/payuQueue.ts", "supabase/functions/_shared/powrotPay.ts", "supabase/functions/_shared/productPrice.ts", "supabase/functions/_shared/settings.ts", "supabase/functions/_shared/shim.ts", "supabase/functions/_shared/smtp.ts", "supabase/functions/_shared/snapshot.ts", "supabase/functions/_shared/supabase.ts", "supabase/functions/_shared/tickets.ts", "supabase/functions/_shared/unpaidReminder.ts", "supabase/functions/_shared/waitlist.ts", "supabase/functions/_shared/welcomeCode.ts", "supabase/functions/cmsScheduled/index.ts"], "checkDiscount": ["supabase/functions/_shared/compat.ts", "supabase/functions/_shared/discounts.ts", "supabase/functions/_shared/errors.ts", "supabase/functions/_shared/productPrice.ts", "supabase/functions/_shared/supabase.ts", "supabase/functions/checkDiscount/index.ts"], "payuCreateOrder": ["supabase/functions/_shared/access.ts", "supabase/functions/_shared/booking.ts", "supabase/functions/_shared/bookingCrypto.ts", "supabase/functions/_shared/bundles.ts", "supabase/functions/_shared/compat.ts", "supabase/functions/_shared/discounts.ts", "supabase/functions/_shared/emailLayout.ts", "supabase/functions/_shared/errors.ts", "supabase/functions/_shared/fulfillOrder.ts", "supabase/functions/_shared/giftCard.ts", "supabase/functions/_shared/invoice.ts", "supabase/functions/_shared/invoices.ts", "supabase/functions/_shared/legalDocs.ts", "supabase/functions/_shared/mirror.ts", "supabase/functions/_shared/newsletter.ts", "supabase/functions/_shared/nextStep.ts", "supabase/functions/_shared/orders.ts", "supabase/functions/_shared/payu.ts", "supabase/functions/_shared/payuQueue.ts", "supabase/functions/_shared/powrotPay.ts", "supabase/functions/_shared/productPrice.ts", "supabase/functions/_shared/rateLimit.ts", "supabase/functions/_shared/seats.ts", "supabase/functions/_shared/settings.ts", "supabase/functions/_shared/shim.ts", "supabase/functions/_shared/smtp.ts", "supabase/functions/_shared/snapshot.ts", "supabase/functions/_shared/supabase.ts", "supabase/functions/_shared/tickets.ts", "supabase/functions/payuCreateOrder/index.ts"], "payuNotification": ["supabase/functions/_shared/access.ts", "supabase/functions/_shared/booking.ts", "supabase/functions/_shared/bookingCrypto.ts", "supabase/functions/_shared/bundles.ts", "supabase/functions/_shared/compat.ts", "supabase/functions/_shared/discounts.ts", "supabase/functions/_shared/emailLayout.ts", "supabase/functions/_shared/fulfillOrder.ts", "supabase/functions/_shared/giftCard.ts", "supabase/functions/_shared/invoices.ts", "supabase/functions/_shared/legalDocs.ts", "supabase/functions/_shared/libraryAccess.ts", "supabase/functions/_shared/mirror.ts", "supabase/functions/_shared/nextStep.ts", "supabase/functions/_shared/orders.ts", "supabase/functions/_shared/payu.ts", "supabase/functions/_shared/payuQueue.ts", "supabase/functions/_shared/powrotPay.ts", "supabase/functions/_shared/productPrice.ts", "supabase/functions/_shared/refunds.ts", "supabase/functions/_shared/settings.ts", "supabase/functions/_shared/shim.ts", "supabase/functions/_shared/smtp.ts", "supabase/functions/_shared/snapshot.ts", "supabase/functions/_shared/supabase.ts", "supabase/functions/_shared/tickets.ts", "supabase/functions/payuNotification/index.ts"], "notifications": ["supabase/functions/_shared/announce.ts", "supabase/functions/_shared/compat.ts", "supabase/functions/_shared/emailLayout.ts", "supabase/functions/_shared/libraryAccess.ts", "supabase/functions/_shared/libraryMedia.ts", "supabase/functions/_shared/libraryNotify.ts", "supabase/functions/_shared/librarySanitize.ts", "supabase/functions/_shared/libraryView.ts", "supabase/functions/_shared/mirror.ts", "supabase/functions/_shared/productPrice.ts", "supabase/functions/_shared/settings.ts", "supabase/functions/_shared/shim.ts", "supabase/functions/_shared/smtp.ts", "supabase/functions/_shared/snapshot.ts", "supabase/functions/_shared/supabase.ts", "supabase/functions/notifications/index.ts"], "adminSettings": ["supabase/functions/_shared/appOffline.ts", "supabase/functions/_shared/compat.ts", "supabase/functions/_shared/firma.ts", "supabase/functions/_shared/invoices.ts", "supabase/functions/_shared/legalDocs.ts", "supabase/functions/_shared/payu.ts", "supabase/functions/_shared/popup.ts", "supabase/functions/_shared/settings.ts", "supabase/functions/_shared/shim.ts", "supabase/functions/_shared/snapshot.ts", "supabase/functions/_shared/supabase.ts", "supabase/functions/_shared/tracking.ts", "supabase/functions/_shared/videoSign.ts", "supabase/functions/adminSettings/index.ts"], "adminOrders": ["supabase/functions/_shared/access.ts", "supabase/functions/_shared/booking.ts", "supabase/functions/_shared/bookingCrypto.ts", "supabase/functions/_shared/bundles.ts", "supabase/functions/_shared/compat.ts", "supabase/functions/_shared/discounts.ts", "supabase/functions/_shared/emailLayout.ts", "supabase/functions/_shared/fulfillOrder.ts", "supabase/functions/_shared/giftCard.ts", "supabase/functions/_shared/invoices.ts", "supabase/functions/_shared/legalDocs.ts", "supabase/functions/_shared/mirror.ts", "supabase/functions/_shared/nextStep.ts", "supabase/functions/_shared/orders.ts", "supabase/functions/_shared/payu.ts", "supabase/functions/_shared/payuQueue.ts", "supabase/functions/_shared/powrotPay.ts", "supabase/functions/_shared/productPrice.ts", "supabase/functions/_shared/refunds.ts", "supabase/functions/_shared/settings.ts", "supabase/functions/_shared/shim.ts", "supabase/functions/_shared/smtp.ts", "supabase/functions/_shared/snapshot.ts", "supabase/functions/_shared/supabase.ts", "supabase/functions/_shared/tickets.ts", "supabase/functions/adminOrders/index.ts"]}};
const KEY_SHA = "c273983eb61a91afdcef4f5fab56e7a63e14dbd428babfa5f0358cd29a927d4a";
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
