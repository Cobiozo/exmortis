import { createHash } from "node:crypto";
import { createClientFromRequest } from "../_shared/compat.ts";
import { getSetting, loadAppUrl } from "../_shared/settings.ts";
import { safeEqual } from "../_shared/libraryAccess.ts";
import { handleNotification, drainPayuEvents, retryUnfulfilled } from "../_shared/payuQueue.ts";
import { applyRefundFromNotification } from "../_shared/refunds.ts";

// Webhook powiadomień PayU — wywoływany z serwerów PayU bez sesji użytkownika.
// Autentyczność weryfikowana podpisem OpenPayU (MD5: treść + drugi klucz).

// Każde podpisane powiadomienie trafia do kolejki public.payu_events (payuQueue.ts): trwały zapis, idempotentne
// przetwarzanie, weryfikacja kwoty/waluty/POS przed uznaniem płatności i ponawianie bez limitu prób.

const handler = async function (req) {
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
    if (!String(order.orderId || "") || !String(order.status || "")) return Response.json({ ok: true });

    // Bieżące powiadomienie: trwały zapis w kolejce i przetworzenie. Błąd bazy → 503, PayU ponowi (kolejka też).
    const result = await handleNotification(base44, payu, order);

    // Zaległe zdarzenia i niedokończone realizacje — po bieżącym, bez wpływu na odpowiedź dla PayU.
    await drainPayuEvents(base44, 3).catch(() => {});
    await retryUnfulfilled(base44, 2).catch(() => {});
    return Response.json({ ok: true, ...result });
  } catch (error) {
    // Błąd bazy albo realizacji: 503, żeby PayU ponowiło powiadomienie zamiast uznać je za dostarczone.
    console.error("payuNotification:", String(error?.message || error).slice(0, 300));
    return Response.json({ ok: false, error: "RETRY" }, { status: 503 });
  }
};

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