import { createHash } from "node:crypto";
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { getSetting } from "../../shared/settings.ts";
import { getOrderByPayuId, updateOrderStatus } from "../../shared/orders.ts";
import { sendMail, orderEmailHtml } from "../../shared/smtp.ts";

// Webhook powiadomień PayU — wywoływany z serwerów PayU bez sesji użytkownika.
// Autentyczność weryfikowana podpisem OpenPayU (MD5: treść + drugi klucz).

export default async function (req) {
  try {
    const raw = await req.text();
    const base44 = createClientFromRequest(req);

    const payu = await getSetting(base44, "payu");
    if (!payu || !payu.secondKey) {
      return new Response("PayU not configured", { status: 400 });
    }

    const sigHeader = req.headers.get("openpayu-signature") || "";
    const parts = Object.fromEntries(
      sigHeader.split(";").map((p) => p.split("=")).filter((p) => p.length === 2)
    );
    const expected = createHash("md5").update(raw + payu.secondKey).digest("hex");
    if (!parts.signature || parts.signature !== expected) {
      return new Response("Invalid signature", { status: 400 });
    }

    const body = JSON.parse(raw);
    const order = body.order || {};
    const payuOrderId = String(order.orderId || "");
    const status = String(order.status || "");
    if (!payuOrderId || !status) return Response.json({ ok: true });

    const stored = await getOrderByPayuId(base44, payuOrderId);
    if (stored) {
      await updateOrderStatus(base44, payuOrderId, status);
      if (status === "COMPLETED" && stored.buyer_email) {
        const smtp = await getSetting(base44, "smtp");
        try {
          const items = Array.isArray(stored.items) ? stored.items : [];
          await sendMail(smtp, {
            to: stored.buyer_email,
            subject: "EXMORTIS — płatność przyjęta",
            html: orderEmailHtml(stored.buyer_name || "", items, stored.total),
          });
        } catch {
          // e-mail potwierdzenia jest opcjonalny — nie blokuj ack dla PayU
        }
      }
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}