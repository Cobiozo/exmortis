import { createHash } from "node:crypto";
import { createClientFromRequest } from "../_shared/compat.ts";
import { getSetting, loadAppUrl } from "../_shared/settings.ts";
import { safeEqual } from "../_shared/libraryAccess.ts";
import { getOrderByPayuId, updateOrderStatus, claimCompletion } from "../_shared/orders.ts";
import { fulfillOrder } from "../_shared/fulfillOrder.ts";
import { applyRefundFromNotification } from "../_shared/refunds.ts";

// Webhook powiadomień PayU — wywoływany z serwerów PayU bez sesji użytkownika.
// Autentyczność weryfikowana podpisem OpenPayU (MD5: treść + drugi klucz).
const handler = async function (req) {
  try {
    const raw = await req.text();
    const base44 = createClientFromRequest(req);
    await loadAppUrl(base44);

    const payu = await getSetting(base44, "payu");
    if (!payu || !payu.secondKey) return new Response("PayU not configured", { status: 400 });

    const sigHeader = req.headers.get("openpayu-signature") || "";
    const parts = Object.fromEntries(sigHeader.split(";").map((p) => p.split("=")).filter((p) => p.length === 2));
    const algo = String(parts.algorithm || "MD5").toUpperCase().replace("-", "");
    const hashName = algo === "SHA256" ? "sha256" : algo === "SHA1" || algo === "SHA" ? "sha1" : "md5";
    const expected = createHash(hashName).update(raw + payu.secondKey).digest("hex");
    if (!parts.signature || !safeEqual(parts.signature.toLowerCase(), expected)) {
      return new Response("Invalid signature", { status: 400 });
    }

    const payload = JSON.parse(raw);

    // Powiadomienie o ZWROCIE — obsługiwane osobno, bez dotykania ścieżki płatności.
    if (payload.refund) {
      await applyRefundFromNotification(base44, payload.refund);
      return Response.json({ ok: true });
    }

    const order = payload.order || {};
    const payuOrderId = String(order.orderId || "");
    const status = String(order.status || "");
    if (!payuOrderId || !status) return Response.json({ ok: true });

    const stored = await getOrderByPayuId(base44, payuOrderId);
    if (!stored) return Response.json({ ok: true });
    if (status !== "COMPLETED") {
      await updateOrderStatus(base44, payuOrderId, status);
      return Response.json({ ok: true });
    }
    // Pierwsze COMPLETED przejmuje dokładnie jedno wywołanie — powtórki PayU nie dublują dostępu ani maili.
    if (!(await claimCompletion(base44, payuOrderId))) return Response.json({ ok: true });
    await fulfillOrder(base44, stored, payuOrderId);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}

// === Supabase Edge (wygenerowane przez docs/tech/migruj.mjs) ===
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const res = await handler(req);
    const h = new Headers(res.headers);
    for (const [k, v] of Object.entries(CORS)) h.set(k, v);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  } catch (e) {
    const msg = String(e?.message || e);
    const status = msg === "FORBIDDEN" ? 403 : e && e.isValidation ? 400 : 500;
    console.error("edge:", msg.slice(0, 300));
    return Response.json({ error: msg.slice(0, 300) }, { status, headers: CORS });
  }
});
