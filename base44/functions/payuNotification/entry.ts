import { createHash } from "node:crypto";
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { getSetting, loadAppUrl } from "../../shared/settings.ts";
import { getOrderByPayuId, updateOrderStatus, claimCompletion } from "../../shared/orders.ts";
import { fulfillOrder } from "../../shared/fulfillOrder.ts";

// Webhook powiadomień PayU — wywoływany z serwerów PayU bez sesji użytkownika.
// Autentyczność weryfikowana podpisem OpenPayU (MD5: treść + drugi klucz).
export default async function (req) {
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
    if (!parts.signature || parts.signature.toLowerCase() !== expected) {
      return new Response("Invalid signature", { status: 400 });
    }

    const order = JSON.parse(raw).order || {};
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