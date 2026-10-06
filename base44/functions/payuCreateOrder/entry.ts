import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { applyDiscount } from "../../shared/discounts.ts";
import { runSql, escStr, textField, emailField } from "../../shared/supabase.ts";
import { getSetting } from "../../shared/settings.ts";
import { insertOrder } from "../../shared/orders.ts";
import { addSubscriber } from "../../shared/newsletter.ts";
import { DIGITAL } from "../../shared/access.ts";

const DIGITAL_CONSENT =
  "Żądam dostarczenia treści cyfrowych przed upływem 14 dni od zawarcia umowy i przyjmuję do wiadomości, że z chwilą rozpoczęcia ich dostarczania tracę prawo odstąpienia od umowy.";

const BASE_URLS = {
  secure: "https://secure.payu.com",
  sandbox: "https://merch-prod.snd.payu.com",
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const buyerName = textField(body, "name", { max: 100 });
    const buyerEmail = emailField(body);
    const note = textField(body, "note", { max: 2000, required: false }) || "";
    const newsletterConsent = body.newsletter_consent === true;
    const items = Array.isArray(body.items) ? body.items.slice(0, 20) : [];
    if (items.length === 0) throw new Error("Koszyk jest pusty");

    // Ceny liczone po stronie serwera — dane z koszyka nie są brane za pewnik.
    const ids = [...new Set(items.map((i) => String((i || {}).id || "")).filter(Boolean))];
    if (ids.length === 0) throw new Error("Koszyk jest pusty");
    const idList = ids.map((id) => escStr(id)).join(",");
    const rows = await runSql(
      base44,
      `SELECT id, name, price::float8 AS price, active, product_type
       FROM public.products WHERE id IN (${idList})`,
      true
    );
    const byId = new Map(rows.map((r) => [String(r.id), r]));
    const hasDigital = rows.some((r) => DIGITAL.includes(r.product_type));
    if (hasDigital && body.digital_consent !== true) {
      throw new Error("Zaznacz zgodę na dostarczenie treści cyfrowych");
    }

    const products = [];
    const stored = [];
    let totalGrosze = 0;
    for (const it of items) {
      const p = byId.get(String((it || {}).id));
      if (!p || p.active === false) throw new Error("Jeden z produktów nie jest już dostępny");
      const qty = Math.max(1, Math.min(20, Math.floor(Number((it || {}).qty) || 1)));
      const unit = Math.round(Number(p.price) * 100);
      if (!Number.isFinite(unit) || unit <= 0) throw new Error("Niepoprawna cena produktu");
      totalGrosze += unit * qty;
      products.push({ name: String(p.name).slice(0, 150), unitPrice: String(unit), quantity: qty });
      stored.push({ product_id: String(p.id), name: String(p.name).slice(0, 150), unitPrice: String(unit), quantity: qty });
    }
    const disc = await applyDiscount(base44, body.code, stored.map((s) => ({
      product_id: s.product_id, unit: Number(s.unitPrice), qty: s.quantity,
    })));
    if (disc) {
      totalGrosze -= disc.discount;
      // PayU wymaga zgodności sumy pozycji z kwotą — jedna pozycja zbiorcza.
      products.length = 0;
      products.push({ name: `EXMORTIS — zamówienie (kod ${disc.code})`, unitPrice: String(totalGrosze), quantity: 1 });
    }
    if (totalGrosze < 100) throw new Error("Kwota zamówienia jest zbyt niska dla PayU");

    const payu = await getSetting(base44, "payu");
    if (!payu || !payu.posId || !payu.clientId || !payu.clientSecret || !payu.secondKey) {
      return Response.json({ error: "PAYU_NOT_CONFIGURED" }, { status: 400 });
    }
    const base = BASE_URLS[payu.env === "sandbox" ? "sandbox" : "secure"];

    const tokenRes = await fetch(`${base}/pl/standard/user/oauth/authorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: payu.clientId,
        client_secret: payu.clientSecret,
      }),
    });
    const token = await tokenRes.json();
    if (!tokenRes.ok || !token.access_token) {
      throw new Error("PayU: błąd autoryzacji (sprawdź Client ID / Client Secret)");
    }

    const extOrderId = crypto.randomUUID();
    const customerIp =
      (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "127.0.0.1";

    const orderRes = await fetch(`${base}/api/v2_1/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token.access_token}`,
      },
      body: JSON.stringify({
        notifyUrl: "https://exmortis-return-path.base44.app/functions/payuNotification",
        continueUrl: "https://exmortis-return-path.base44.app/kasa?payu=done",
        customerIp,
        merchantPosId: String(payu.posId),
        description: "EXMORTIS — skarbiec",
        currencyCode: "PLN",
        totalAmount: String(totalGrosze),
        extOrderId,
        buyer: { email: buyerEmail, firstName: buyerName.slice(0, 100), language: "pl" },
        products,
      }),
    });
    const data = await orderRes.json();
    if (!orderRes.ok || !data.redirectUri) {
      throw new Error(
        (data && data.error && data.error.message) || "PayU: nie udało się utworzyć płatności"
      );
    }

    await insertOrder(base44, {
      id: extOrderId,
      payuOrderId: String(data.orderId || ""),
      buyerName,
      buyerEmail,
      note: disc ? `${note}${note ? "\n" : ""}Kod rabatowy: ${disc.code} (−${(disc.discount / 100).toFixed(2)} zł)` : note,
      items: stored,
      total: totalGrosze / 100,
      status: "PENDING",
      newsletterConsent,
      digitalConsent: hasDigital ? DIGITAL_CONSENT : null,
    });

    if (disc) {
      await base44.asServiceRole.entities.DiscountCode.update(disc.record.id, { uses: (disc.record.uses || 0) + 1 });
    }

    if (newsletterConsent) {
      await addSubscriber(base44, { email: buyerEmail, name: buyerName, consentGiven: true });
    }

    return Response.json({ redirectUri: data.redirectUri, orderId: extOrderId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}