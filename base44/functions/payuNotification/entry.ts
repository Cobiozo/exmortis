import { createHash } from "node:crypto";
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { getSetting, loadAppUrl, APP_URL } from "../../shared/settings.ts";
import { getOrderByPayuId, updateOrderStatus } from "../../shared/orders.ts";
import { sendMail, orderEmailHtml } from "../../shared/smtp.ts";
import { runSql, escStr } from "../../shared/supabase.ts";
import { DIGITAL, grantAccess, ensureAccount } from "../../shared/access.ts";

const PL_DATE = (ymd) =>
  new Date(`${ymd}T12:00:00Z`).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });

function accessEmailHtml(granted, consent) {
  if (!granted.length) return "";
  const rows = granted
    .map((g) => `<p style="color:#E2E2E2;margin:0 0 6px;">${String(g.name).replace(/</g, "&lt;")} · Dostęp ${g.until ? `do ${PL_DATE(g.until)}` : "bezterminowo"}</p>`)
    .join("");
  return `<div style="background:#0A0A0B;padding:0 32px 32px;font-family:Georgia,serif;">
    ${rows}
    <p style="margin:20px 0;"><a href="${APP_URL}/konto" style="color:#C9A24A;">Otwórz w Moich produktach</a></p>
    ${consent ? `<p style="color:#8A8A8C;font-size:13px;line-height:1.6;">Potwierdzam Twoje żądanie dostarczenia treści cyfrowych przed upływem 14 dni od zawarcia umowy oraz przyjęcie do wiadomości utraty prawa odstąpienia od umowy z chwilą rozpoczęcia dostarczania.</p>` : ""}
    <p style="color:#5C5C5E;font-size:12px;line-height:1.6;">exmortis to mentoring, nie terapia. Jeśli jest Ci bardzo ciężko: 116 123 · 800 70 2222 · w zagrożeniu życia 112.</p>
  </div>`;
}

// Webhook powiadomień PayU — wywoływany z serwerów PayU bez sesji użytkownika.
// Autentyczność weryfikowana podpisem OpenPayU (MD5: treść + drugi klucz).

export default async function (req) {
  try {
    const raw = await req.text();
    const base44 = createClientFromRequest(req);
    await loadAppUrl(base44);

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
      const firstCompletion = status === "COMPLETED" && stored.status !== "COMPLETED";
      await updateOrderStatus(base44, payuOrderId, status);
      if (firstCompletion && stored.buyer_email) {
        const items = Array.isArray(stored.items) ? stored.items : [];
        // Dostęp nadawany dopiero po potwierdzeniu płatności przez PayU.
        const ids = items.map((i) => i.product_id).filter(Boolean);
        const granted = [];
        if (ids.length) {
          const rows = await runSql(
            base44,
            `SELECT id, name, product_type, access_months FROM public.products WHERE id::text IN (${ids.map(escStr).join(",")})`,
            true
          );
          for (const p of rows.filter((r) => DIGITAL.includes(r.product_type))) {
            const until = await grantAccess(base44, { email: stored.buyer_email, product: p, source: "zakup", orderId: stored.id });
            granted.push({ name: p.name, until });
          }
          if (granted.length) await ensureAccount(base44, stored.buyer_email);
        }
        try {
          await sendMail(base44, {
            kind: "zamowienie", ref: stored.id,
            to: stored.buyer_email,
            subject: "EXMORTIS — płatność przyjęta",
            html: orderEmailHtml(stored.buyer_name || "", items, stored.total) + accessEmailHtml(granted, !!stored.digital_consent_text),
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