import { createHash } from "node:crypto";
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { getSetting, loadAppUrl } from "../../shared/settings.ts";
import { safeEqual } from "../../shared/libraryAccess.ts";
import {
  findOrderForNotification, updateOrderStatus, claimCompletion, releaseCompletion,
  recordPayuEvent, pendingPayuEvents, closePayuEvent,
} from "../../shared/orders.ts";
import { fulfillOrder } from "../../shared/fulfillOrder.ts";
import { applyRefundFromNotification } from "../../shared/refunds.ts";
import { localPayuStatus } from "../../shared/payu.ts";

// Webhook powiadomień PayU — wywoływany z serwerów PayU bez sesji użytkownika.
// Autentyczność weryfikowana podpisem OpenPayU (MD5: treść + drugi klucz).

// Statusy, które kończą płatność: COMPLETED realizuje zamówienie, CANCELED je zamyka.
// PENDING i WAITING_FOR_CONFIRMATION zostawiają zamówienie jako opłacane w toku.
async function processOrder(base44, payuOrderId, status, order) {
  const extOrderId = String(order?.extOrderId || "");
  const stored = await findOrderForNotification(base44, payuOrderId, extOrderId);

  // Zamówienia jeszcze nie ma (np. powiadomienie wyprzedziło zapis) — zapisujemy zdarzenie trwale.
  if (!stored) {
    await recordPayuEvent(base44, { payuOrderId, extOrderId, payuStatus: status, order });
    return { stored: false };
  }

  const local = localPayuStatus(status);
  if (local !== "COMPLETED") {
    await updateOrderStatus(base44, payuOrderId, local, status);
    return { stored: true, status: local };
  }

  // Pierwsze COMPLETED przejmuje dokładnie jedno wywołanie — powtórki nie dublują dostępu ani maili.
  if (!(await claimCompletion(base44, payuOrderId))) return { stored: true, duplicate: true };
  try {
    await fulfillOrder(base44, stored, payuOrderId);
  } catch (e) {
    // Realizacja nie doszła do końca — cofamy przejęcie, żeby PayU mogło ponowić.
    await releaseCompletion(base44, payuOrderId, stored.status).catch(() => {});
    throw e;
  }
  return { stored: true, status: "COMPLETED" };
}

// Zdarzenia zapisane wcześniej (zamówienie nie istniało) — ponawiane przy każdym powiadomieniu.
async function drainPending(base44, limit = 5) {
  const pending = await pendingPayuEvents(base44, limit);
  for (const ev of pending) {
    const order = ev.payload?.order || null;
    const payuOrderId = String(order?.orderId || ev.payu_order_id || "");
    const status = String(order?.status || ev.payu_status || "").toUpperCase();
    if (!payuOrderId || !status) {
      await closePayuEvent(base44, ev.id);
      continue;
    }
    try {
      const stored = await findOrderForNotification(base44, payuOrderId, String(order?.extOrderId || ev.ext_order_id || ""));
      if (!stored) {
        // Wciąż brak zamówienia — zostaje w kolejce, a po kilku próbach wypada (closePayuEvent).
        await closePayuEvent(base44, ev.id, "brak zamówienia");
        continue;
      }
      await processOrder(base44, payuOrderId, status, order || {});
      await closePayuEvent(base44, ev.id);
    } catch (e) {
      await closePayuEvent(base44, ev.id, String(e?.message || e).slice(0, 200));
    }
  }
}

export default async function (req) {
  try {
    const raw = await req.text();
    const base44 = createClientFromRequest(req);
    await loadAppUrl(base44);

    const payu = await getSetting(base44, "payu");
    if (!payu || !payu.secondKey) return new Response("PayU not configured", { status: 400 });

    // Nagłówek: algorithm=MD5;signature=...;timestamp=...
    const sigHeader = req.headers.get("openpayu-signature") || "";
    const parts = {};
    for (const p of sigHeader.split(";")) {
      const i = p.indexOf("=");
      if (i > 0) parts[p.slice(0, i).trim().toLowerCase()] = p.slice(i + 1).trim();
    }
    const algo = String(parts.algorithm || "MD5").toUpperCase().replace("-", "");
    const hashName = algo === "SHA256" ? "sha256" : algo === "SHA1" || algo === "SHA" ? "sha1" : "md5";
    const expected = createHash(hashName).update(raw + payu.secondKey).digest("hex");
    if (!parts.signature || !safeEqual(parts.signature.toLowerCase(), expected)) {
      return new Response("Invalid signature", { status: 400 });
    }

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return new Response("Invalid payload", { status: 400 });
    }

    // Powiadomienie o ZWROCIE — obsługiwane osobno, bez dotykania ścieżki płatności.
    if (payload.refund) {
      await applyRefundFromNotification(base44, payload.refund);
      return Response.json({ ok: true });
    }

    const order = payload.order || {};
    const payuOrderId = String(order.orderId || "");
    const status = String(order.status || "").toUpperCase();
    if (!payuOrderId || !status) return Response.json({ ok: true });

    // Najpierw zaległe zdarzenia, potem bieżące.
    await drainPending(base44).catch(() => {});

    const result = await processOrder(base44, payuOrderId, status, order);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    // Błąd bazy albo realizacji: 503, żeby PayU ponowiło powiadomienie zamiast uznać je za dostarczone.
    console.error("payuNotification:", String(error?.message || error).slice(0, 300));
    return Response.json({ ok: false, error: "RETRY" }, { status: 503 });
  }
}