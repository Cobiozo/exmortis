// TYMCZASOWE WDROŻENIE: kampanie popup (wariant M) + opcje kodów rabatowych — 7 funkcji — 17.11.2026, na polecenie właściciela („buduj”).
// Autoryzacja: nagłówek X-Exm-Deploy — jednorazowy klucz; w kodzie jest tylko jego skrót SHA-256.
// Bez klucza → 401. Po wdrożeniu funkcja wraca do 410.
// Projekt Supabase: fqhvxhnbeyvwubpnuzxe. Kod funkcji z GitHub Cobiozo/exmortis @ COMMIT, sprawdzany SHA-256.
// Odpowiedzi bez danych osobowych i bez wartości kluczy.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql } from "../../shared/supabase.ts";

const COMMIT = "2d2d531c74c0458abfc0aef9eef3c2c3e56f6b3a";
const MANIFEST: { files: Record<string, string>; fn: Record<string, string[]> } = {"files": {"supabase/functions/_shared/access.ts": "737b84b6df8b79d91e086c715b83a96090205251970c7a96a40ead18630d131b", "supabase/functions/_shared/appOffline.ts": "aca02a8b5d3268bdce116a5b6d27dfd0cd5d5bc9eb717c379c9b26fe15801a32", "supabase/functions/_shared/compat.ts": "2d8bcaf24033b911c2cfa76fc0409fffaac5eac3256904dc05332c8bf29ed16b", "supabase/functions/_shared/firma.ts": "08f1468f17796093da27ca1d2372d811bd1128eaaaefe8fd2f99d038f1ad4af8", "supabase/functions/_shared/invoices.ts": "87b52966f71a5d865c0205fdb5ceac3adfcfae02a1db55d899a7472f303e4d09", "supabase/functions/_shared/legalDocs.ts": "6021a013ab8a08d88fdeeecf166a437c675809f958c12786964165837c874d1a", "supabase/functions/_shared/mirror.ts": "b65e1419e3341fb805238621733934745090ec80d9acbc0e6c13bdb4c3a20730", "supabase/functions/_shared/payu.ts": "2affb0d0f1f16c4b938714b6a9a528f86b3db19212ec96caae3731708cc87e15", "supabase/functions/_shared/popup.ts": "b05b05fa3d6e0b69beb2ecf03cbe21a9bdfab77786cdf6ea6510aee220d440d9", "supabase/functions/_shared/productPrice.ts": "090801d8635165ce89b6ea2bd2021bb8064b40e3575f662f41fcdb5d34af8f1d", "supabase/functions/_shared/settings.ts": "5741fa2ae6adf8672d02f69e3b11e79e4b659e74e4729e7ba3c3fa03a59976d7", "supabase/functions/_shared/shim.ts": "1d1a6916eef8a54dbd38bd71bd5a9d007a021ba357dfe69d1b52127bc2f3d63c", "supabase/functions/_shared/snapshot.ts": "c5ea0485874fd261422c66793dea3fa45e9b2b5771f69a2cb9c86dea78aeb641", "supabase/functions/_shared/supabase.ts": "72ca71fb3860420dbdd4041bdbe4e70b149ce06b08072db9f16e029b9b18f82e", "supabase/functions/_shared/tracking.ts": "5a296c1ea917ca84e55c5e8b780a091fd69b02b61092c0d6cde4ad57e5f670ca", "supabase/functions/_shared/videoSign.ts": "3e15cdff42c370a058bdfcd53fc59517dcce3979301077021d491063dc1d0821", "supabase/functions/adminSettings/index.ts": "0da344586e5e12b0337a67f76d2140dd84dfc50f12f5fd5e398d5d99927f77b4", "supabase/functions/_shared/discounts.ts": "16995e22335ae272375e5a384ae4eadad96a6f09be47c032aabaa2ef8f116804", "supabase/functions/_shared/errors.ts": "00e658023f0c15251944f18ec454cb86c264d493090028f5b240561169e5f94e", "supabase/functions/checkDiscount/index.ts": "4e5c6d7b5debccc9c187be737cf30150880a95561ba4516918629c3e7d0c0e3f", "supabase/functions/_shared/booking.ts": "0f21468143f8bf394d4a600aace75d18e1a743c4254fca163d15835583a3b2fc", "supabase/functions/_shared/bookingCrypto.ts": "2d955ac5b9fecac150671c0b0d845f31761f3f7cee273cdbcb67478a91506a15", "supabase/functions/_shared/bundles.ts": "1d7e6eba44cdc0eecbb65afcf72f948b961191ea2d7505e032b70b57f977cccf", "supabase/functions/_shared/emailLayout.ts": "d5c05662b061a01e5e73a014a8b3b4287e87109a0ff1ded3d7c6111e0e98e6ad", "supabase/functions/_shared/fulfillOrder.ts": "0fbb5f36bc27b72d799c31b5a717415f73320abb6f8139a25807cc52b89f780f", "supabase/functions/_shared/giftCard.ts": "bb40315d0e06324e1554f6b2dd2b9c43e2bec1a72a79e5e59791fa32ba73e226", "supabase/functions/_shared/invoice.ts": "a9f2e23bb705b8418fa638a403f92fdbac5a8d60a7288ca96c845a00f9ba0d12", "supabase/functions/_shared/newsletter.ts": "6c894a37b7e64e15edbe75f1bc84b33417cd0c1d07d865bf53663d107c812417", "supabase/functions/_shared/nextStep.ts": "b92fe7a692cb427eb59657323d314cba48707d3364388df3e5daea3aa4429ada", "supabase/functions/_shared/orderLinks.ts": "13b8f1df1acfc7bb75df5f1b205f29574ee603d9897cef3fb20c878ab5b860f6", "supabase/functions/_shared/orders.ts": "d995edf4dd9b954591a0f9b5bf3ef8aad121fd43f20e2cdd083d49420def4301", "supabase/functions/_shared/payuQueue.ts": "a2e547570bd84074becacf609ae6d32ecef7fa04d95df6f3308f48f72843800d", "supabase/functions/_shared/powrotPay.ts": "95499e9b13f6cbe3d33af8e4af635205f4f4cbc88d62f4d3ae46ca969bf38fc5", "supabase/functions/_shared/rateLimit.ts": "807a3572e07a2a22945abad56a870296b3bd58cf906ccb7eeea1b3f37da6db22", "supabase/functions/_shared/seats.ts": "6c4ef6be8794edd1123eb76e49ecc68b1d2ff22e754560e06c708275f920496b", "supabase/functions/_shared/smtp.ts": "4e77bc83038981beb68f9169490dc51bba6491f75d2185225da254965e90c66e", "supabase/functions/_shared/tickets.ts": "21c478c7eed6b3c06a61ae30b968ecfd7198711e80f6b14b7f1ebca6d1c2b600", "supabase/functions/payuCreateOrder/index.ts": "f1bbe9a4f5502840bc513422b338f5fb344183869e64557a43b741f244c2952a", "supabase/functions/_shared/publicData.ts": "b58a9acb77d055e538344cab467b7c66aaf6a78a1a226f1cb29372d249e9474d", "supabase/functions/bootstrap/index.ts": "55009ab7c32839715811c28de30f6c8141a87d3e482217cf18402c99778044a9", "supabase/functions/siteSettings/index.ts": "6bbf12f7404b0d5e1221905a36786df006f20deb04b5663e625ece3d3afca6dc", "supabase/functions/_shared/events.ts": "7e2a9b13908e64a9223aa2965bbee010c4870490944318e3474b11d1e78ec50d", "supabase/functions/_shared/followup.ts": "61dea4b8c93adeab51a2e45be02234eb92ede4fe08c37c422f1114f25128e5d4", "supabase/functions/_shared/libraryAccess.ts": "d619471cbae070fd3a5a26e63d309dd6519861d5323df3ca932442770a647557", "supabase/functions/_shared/registrations.ts": "fa7b5bfc05846b586b999453fbe3c43afa464f9abab9a53aac3d2c1e8372b032", "supabase/functions/_shared/retention.ts": "478c09b7d753165499cec034612d85873fe4386cc1493b9c9123d7d1586afb0a", "supabase/functions/eventsPublic/index.ts": "9f2faa14d72eab0a0c498e5a30fddbac6bb91097cdbcc8cde44d8244727e94c4", "supabase/functions/siteContent/index.ts": "53ad4baead627cddb27d6c44ef23456efcd05356ceedd16867e2ef7d610ca0ae"}, "fn": {"adminSettings": ["supabase/functions/_shared/access.ts", "supabase/functions/_shared/appOffline.ts", "supabase/functions/_shared/compat.ts", "supabase/functions/_shared/firma.ts", "supabase/functions/_shared/invoices.ts", "supabase/functions/_shared/legalDocs.ts", "supabase/functions/_shared/mirror.ts", "supabase/functions/_shared/payu.ts", "supabase/functions/_shared/popup.ts", "supabase/functions/_shared/productPrice.ts", "supabase/functions/_shared/settings.ts", "supabase/functions/_shared/shim.ts", "supabase/functions/_shared/snapshot.ts", "supabase/functions/_shared/supabase.ts", "supabase/functions/_shared/tracking.ts", "supabase/functions/_shared/videoSign.ts", "supabase/functions/adminSettings/index.ts"], "checkDiscount": ["supabase/functions/_shared/compat.ts", "supabase/functions/_shared/discounts.ts", "supabase/functions/_shared/errors.ts", "supabase/functions/_shared/productPrice.ts", "supabase/functions/_shared/supabase.ts", "supabase/functions/checkDiscount/index.ts"], "payuCreateOrder": ["supabase/functions/_shared/access.ts", "supabase/functions/_shared/booking.ts", "supabase/functions/_shared/bookingCrypto.ts", "supabase/functions/_shared/bundles.ts", "supabase/functions/_shared/compat.ts", "supabase/functions/_shared/discounts.ts", "supabase/functions/_shared/emailLayout.ts", "supabase/functions/_shared/errors.ts", "supabase/functions/_shared/fulfillOrder.ts", "supabase/functions/_shared/giftCard.ts", "supabase/functions/_shared/invoice.ts", "supabase/functions/_shared/invoices.ts", "supabase/functions/_shared/legalDocs.ts", "supabase/functions/_shared/mirror.ts", "supabase/functions/_shared/newsletter.ts", "supabase/functions/_shared/nextStep.ts", "supabase/functions/_shared/orderLinks.ts", "supabase/functions/_shared/orders.ts", "supabase/functions/_shared/payu.ts", "supabase/functions/_shared/payuQueue.ts", "supabase/functions/_shared/powrotPay.ts", "supabase/functions/_shared/productPrice.ts", "supabase/functions/_shared/rateLimit.ts", "supabase/functions/_shared/seats.ts", "supabase/functions/_shared/settings.ts", "supabase/functions/_shared/shim.ts", "supabase/functions/_shared/smtp.ts", "supabase/functions/_shared/snapshot.ts", "supabase/functions/_shared/supabase.ts", "supabase/functions/_shared/tickets.ts", "supabase/functions/payuCreateOrder/index.ts"], "bootstrap": ["supabase/functions/_shared/access.ts", "supabase/functions/_shared/appOffline.ts", "supabase/functions/_shared/compat.ts", "supabase/functions/_shared/firma.ts", "supabase/functions/_shared/legalDocs.ts", "supabase/functions/_shared/mirror.ts", "supabase/functions/_shared/popup.ts", "supabase/functions/_shared/productPrice.ts", "supabase/functions/_shared/publicData.ts", "supabase/functions/_shared/settings.ts", "supabase/functions/_shared/shim.ts", "supabase/functions/_shared/snapshot.ts", "supabase/functions/_shared/supabase.ts", "supabase/functions/_shared/tracking.ts", "supabase/functions/bootstrap/index.ts"], "siteSettings": ["supabase/functions/_shared/access.ts", "supabase/functions/_shared/appOffline.ts", "supabase/functions/_shared/compat.ts", "supabase/functions/_shared/firma.ts", "supabase/functions/_shared/legalDocs.ts", "supabase/functions/_shared/mirror.ts", "supabase/functions/_shared/popup.ts", "supabase/functions/_shared/productPrice.ts", "supabase/functions/_shared/publicData.ts", "supabase/functions/_shared/settings.ts", "supabase/functions/_shared/shim.ts", "supabase/functions/_shared/snapshot.ts", "supabase/functions/_shared/supabase.ts", "supabase/functions/_shared/tracking.ts", "supabase/functions/siteSettings/index.ts"], "eventsPublic": ["supabase/functions/_shared/access.ts", "supabase/functions/_shared/appOffline.ts", "supabase/functions/_shared/compat.ts", "supabase/functions/_shared/emailLayout.ts", "supabase/functions/_shared/events.ts", "supabase/functions/_shared/firma.ts", "supabase/functions/_shared/followup.ts", "supabase/functions/_shared/legalDocs.ts", "supabase/functions/_shared/libraryAccess.ts", "supabase/functions/_shared/mirror.ts", "supabase/functions/_shared/newsletter.ts", "supabase/functions/_shared/popup.ts", "supabase/functions/_shared/productPrice.ts", "supabase/functions/_shared/publicData.ts", "supabase/functions/_shared/rateLimit.ts", "supabase/functions/_shared/registrations.ts", "supabase/functions/_shared/retention.ts", "supabase/functions/_shared/settings.ts", "supabase/functions/_shared/shim.ts", "supabase/functions/_shared/smtp.ts", "supabase/functions/_shared/snapshot.ts", "supabase/functions/_shared/supabase.ts", "supabase/functions/_shared/tickets.ts", "supabase/functions/_shared/tracking.ts", "supabase/functions/eventsPublic/index.ts"], "siteContent": ["supabase/functions/_shared/access.ts", "supabase/functions/_shared/appOffline.ts", "supabase/functions/_shared/compat.ts", "supabase/functions/_shared/firma.ts", "supabase/functions/_shared/legalDocs.ts", "supabase/functions/_shared/mirror.ts", "supabase/functions/_shared/popup.ts", "supabase/functions/_shared/productPrice.ts", "supabase/functions/_shared/publicData.ts", "supabase/functions/_shared/settings.ts", "supabase/functions/_shared/shim.ts", "supabase/functions/_shared/snapshot.ts", "supabase/functions/_shared/supabase.ts", "supabase/functions/_shared/tracking.ts", "supabase/functions/siteContent/index.ts"]}};
const KEY_SHA = "d1feb6b6bfcd88deedf0fff798bdee507df571f4050bf1b9c0d54377ccb2a77b";
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
