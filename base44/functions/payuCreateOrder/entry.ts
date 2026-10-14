import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { applyDiscount } from "../../shared/discounts.ts";
import { runSql, escStr, textField, emailField, clientIp } from "../../shared/supabase.ts";
import { getSetting, loadAppUrl, APP_URL } from "../../shared/settings.ts";
import { insertOrder, getOrderStatus, getOrderByPayuId, claimCompletion } from "../../shared/orders.ts";
import { fulfillOrder } from "../../shared/fulfillOrder.ts";
import { addSubscriber } from "../../shared/newsletter.ts";
import { DIGITAL } from "../../shared/access.ts";
import { regulaminVersion } from "../../shared/legalDocs.ts";
import { unitPrice } from "../../shared/productPrice.ts";
import { cleanInvoice, invoiceText } from "../../shared/invoice.ts";
import { giftLine } from "../../shared/giftCard.ts";
import { ticketLines } from "../../shared/tickets.ts";

const DIGITAL_CONSENT =
  "Żądam dostarczenia treści cyfrowych przed upływem 14 dni od zawarcia umowy i przyjmuję do wiadomości, że z chwilą rozpoczęcia ich dostarczania tracę prawo odstąpienia od umowy.";

// Każda zgoda zapisana osobno, z wersją dokumentu.
async function saveConsents(base44, req, orderId, email, hasDigital, newsletterConsent) {
  const cBase = { email, source: "kasa", order_id: orderId, doc_version: `regulamin ${await regulaminVersion(base44)}`, ip: clientIp(req), status: "udzielona" };
  const consents = [{ ...cBase, kind: "regulamin", text: "Akceptuję Regulamin. Znam Politykę prywatności." }];
  if (hasDigital) consents.push({ ...cBase, kind: "tresci_cyfrowe", text: DIGITAL_CONSENT });
  if (newsletterConsent) consents.push({ ...cBase, kind: "newsletter", text: "Chcę otrzymywać Listy powrotu — newsletter exmortis z treściami oraz informacjami o produktach i wydarzeniach — na podany adres e-mail. Zgodę mogę wycofać w każdej chwili." });
  await base44.asServiceRole.entities.Consent.bulkCreate(consents);
}

const BASE_URLS = {
  secure: "https://secure.payu.com",
  sandbox: "https://merch-prod.snd.payu.com",
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    await loadAppUrl(base44);
    const body = await req.json().catch(() => ({}));

    // Strona powrotu z PayU pyta o stan: tylko status, po losowym numerze zamówienia (UUID), bez danych osobowych.
    if (body.action === "status") {
      const id = String(body.orderId || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ status: null });
      return Response.json({ status: await getOrderStatus(base44, id) });
    }

    const buyerName = textField(body, "name", { max: 100 });
    const buyerEmail = emailField(body);
    const note = textField(body, "note", { max: 2000, required: false }) || "";
    const newsletterConsent = body.newsletter_consent === true;
    if (body.terms_consent !== true) throw new Error("Zaakceptuj Regulamin");
    const invoice = cleanInvoice(body.invoice);
    const items = Array.isArray(body.items) ? body.items.slice(0, 20) : [];
    if (items.length === 0) throw new Error("Koszyk jest pusty");

    // Bilety na wydarzenia (cena, miejsca i termin sprzedaży z serwera) — osobno od produktów Skarbca.
    const ticketItems = items.filter((i) => i && i.kind === "bilet");
    const productItems = items.filter((i) => !(i && i.kind === "bilet"));
    const tickets = await ticketLines(base44, ticketItems);

    // Ceny liczone po stronie serwera — dane z koszyka nie są brane za pewnik.
    const ids = [...new Set(productItems.map((i) => String((i || {}).id || "")).filter(Boolean))];
    if (ids.length === 0 && tickets.length === 0) throw new Error("Koszyk jest pusty");
    const idList = ids.map((id) => escStr(id)).join(",");
    const rows = !ids.length ? [] : await runSql(
      base44,
      `SELECT id, name, price::float8 AS price, price_regular::float8 AS price_regular, price_start::float8 AS price_start,
              promo_end_date::text AS promo_end_date, to_jsonb(p)->'price_steps' AS price_steps,
              active, is_free, COALESCE(status, 'dostępny') AS status, product_type, to_jsonb(p)->'price_options' AS price_options
       FROM public.products p WHERE id IN (${idList})`,
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
    for (const t of tickets) {
      totalGrosze += Number(t.unitPrice) * t.quantity;
      products.push({ name: t.name, unitPrice: t.unitPrice, quantity: t.quantity });
      stored.push(t);
    }
    for (const it of productItems) {
      const p = byId.get(String((it || {}).id));
      // Produkty „wkrótce”, ukryte i darmowe nie są sprzedawane przez kasę.
      if (!p || p.active === false || p.status === "wkrótce" || p.status === "ukryty" || p.is_free === true) {
        throw new Error("Jeden z produktów nie jest już dostępny");
      }
      const qty = Math.max(1, Math.min(20, Math.floor(Number((it || {}).qty) || 1)));
      // Karta podarunkowa: kwota wybrana przez klienta — tylko z listy kwot produktu (albo zwykła cena, gdy listy nie ma).
      const card = giftLine(p, it);
      const unit = card ? card.unit : Math.round(unitPrice(p) * 100);
      if (!Number.isFinite(unit) || unit <= 0) throw new Error("Niepoprawna cena produktu");
      totalGrosze += unit * qty;
      const label = card ? `${String(p.name).slice(0, 120)} ${(unit / 100).toFixed(0)} zł` : String(p.name).slice(0, 150);
      products.push({ name: label, unitPrice: String(unit), quantity: qty });
      stored.push({ product_id: String(p.id), name: label, unitPrice: String(unit), quantity: qty, ...(card ? { gift: card.gift } : {}) });
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
    if (totalGrosze < 0) totalGrosze = 0;
    if (totalGrosze > 0 && totalGrosze < 100) throw new Error("Kwota zamówienia jest zbyt niska dla PayU");

    // Zamówienie za 0 zł (np. całość pokryta kartą) — bez bramki PayU, od razu realizowane.
    if (totalGrosze === 0) {
      const id = crypto.randomUUID();
      const freeId = `FREE-${id}`;
      await insertOrder(base44, {
        id, payuOrderId: freeId, buyerName, buyerEmail,
        note: [note, invoice ? invoiceText(invoice) : "", disc ? `Kod rabatowy: ${disc.code} (−${(disc.discount / 100).toFixed(2)} zł)` : ""].filter(Boolean).join("\n"),
        invoice, items: stored, total: 0, status: "PENDING", newsletterConsent,
        digitalConsent: hasDigital ? DIGITAL_CONSENT : null,
        discountCode: disc ? disc.code : null,
      });
      await saveConsents(base44, req, id, buyerEmail, hasDigital, newsletterConsent);
      if (newsletterConsent) await addSubscriber(base44, { email: buyerEmail, name: buyerName, consentGiven: true });
      const order = await getOrderByPayuId(base44, freeId);
      if (await claimCompletion(base44, freeId)) await fulfillOrder(base44, order, freeId);
      return Response.json({ redirectUri: `${APP_URL}/kasa?payu=done`, orderId: id, free: true });
    }

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
    const realIp = clientIp(req);
    const customerIp = realIp === "brak" ? "127.0.0.1" : realIp;

    const orderRes = await fetch(`${base}/api/v2_1/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token.access_token}`,
      },
      body: JSON.stringify({
        notifyUrl: `${APP_URL}/functions/payuNotification`,
        continueUrl: `${APP_URL}/kasa?payu=done`,
        customerIp,
        merchantPosId: String(payu.posId),
        description: tickets.length ? "EXMORTIS — bilety" : "EXMORTIS — skarbiec",
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
      note: [note, invoice ? invoiceText(invoice) : "", disc ? `Kod rabatowy: ${disc.code} (−${(disc.discount / 100).toFixed(2)} zł)` : ""].filter(Boolean).join("\n"),
      invoice,
      items: stored,
      total: totalGrosze / 100,
      status: "PENDING",
      newsletterConsent,
      digitalConsent: hasDigital ? DIGITAL_CONSENT : null,
      discountCode: disc ? disc.code : null,
    });

    await saveConsents(base44, req, extOrderId, buyerEmail, hasDigital, newsletterConsent);

    // Licznik użyć kodu rośnie dopiero po opłaceniu (payuNotification).

    if (newsletterConsent) {
      await addSubscriber(base44, { email: buyerEmail, name: buyerName, consentGiven: true });
    }

    return Response.json({ redirectUri: data.redirectUri, orderId: extOrderId });
  } catch (error) {
    // Błąd walidacji formularza = 400 (wina danych), reszta = 500.
    const bad = /^(Brak pola|Pole .* jest zbyt długie|Niepoprawny adres e-mail|Zaakceptuj|Zaznacz|Koszyk jest pusty|Jeden z produktów|Nieprawidłowy kod|Kod |Kodem |Kwota zamówienia|Podaj |Niepoprawny NIP|Bilet:|Brak wolnych)/.test(String(error?.message || ""));
    return Response.json({ error: error.message }, { status: bad ? 400 : 500 });
  }
}