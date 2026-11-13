import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { applyDiscount, reserveCode, releaseCode } from "../../shared/discounts.ts";
import { runSql, escStr, textField, emailField, clientIp } from "../../shared/supabase.ts";
import { ipAllowed, TOO_MANY } from "../../shared/rateLimit.ts";
import { getSetting, loadAppUrl, APP_URL } from "../../shared/settings.ts";
import {
  insertOrder, getOrderStatus,
  insertCreatingOrder, attachPayuOrder, markOrderFailed,
} from "../../shared/orders.ts";
import { payuToken, payuCreateOrder } from "../../shared/payu.ts";
import { errorResponse } from "../../shared/errors.ts";
import { mirrorRecord } from "../../shared/mirror.ts";
import { markPaid, fulfillPaid, nudgeOrder } from "../../shared/payuQueue.ts";
import { addSubscriber } from "../../shared/newsletter.ts";
import { DIGITAL } from "../../shared/access.ts";
import { productSeats } from "../../shared/seats.ts";
import { regulaminVersion } from "../../shared/legalDocs.ts";
import { unitPrice } from "../../shared/productPrice.ts";
import { cleanInvoice, invoiceText } from "../../shared/invoice.ts";
import { appByPayToken, isPaid, isExpired, PROGRAM_NAME, CONTRACT_CONSENT, EARLY_CONSENT } from "../../shared/powrotPay.ts";
import { docLatest } from "../../shared/legalDocs.ts";
import { giftLine } from "../../shared/giftCard.ts";
import { ticketLines } from "../../shared/tickets.ts";

const firstNameOf = (full) => String(full ?? "").trim().split(/\s+/)[0] || "";
const validation = (msg) => Object.assign(new Error(msg), { isValidation: true });

const DIGITAL_CONSENT =
  "Chcę otrzymać dostęp od razu po zapłacie, przed upływem 14 dni na odstąpienie od umowy. Wiem, że z chwilą rozpoczęcia dostarczania tracę prawo odstąpienia.";

const SERVICE_CONSENT =
  "Żądam rozpoczęcia świadczenia usługi przed upływem 14 dni od zawarcia umowy. Przyjmuję do wiadomości, że jeśli odstąpię od umowy, zapłacę za część usługi wykonaną do chwili odstąpienia, a po pełnym wykonaniu usługi utracę prawo odstąpienia.";

// Każda zgoda zapisana osobno, z wersją dokumentu.
const ACCOUNT_TEXT =
  "Chcę założyć bezpłatne konto exmortis na podany adres e-mail (Biblioteka, ROZDROŻA, kupione produkty w jednym miejscu). Link do ustawienia hasła otrzymam po zakupie.";

async function saveConsents(base44, req, orderId, email, hasDigital, newsletterConsent, hasService = false, createAccount = false) {
  const cBase = { email, source: "kasa", order_id: orderId, doc_version: `regulamin ${await regulaminVersion(base44)}`, ip: clientIp(req), status: "udzielona" };
  const consents = [{ ...cBase, kind: "regulamin", text: "Akceptuję Regulamin." }];
  if (hasService) consents.push({ ...cBase, kind: "usluga", text: SERVICE_CONSENT });
  if (hasDigital) consents.push({ ...cBase, kind: "tresci_cyfrowe", text: DIGITAL_CONSENT });
  // Prośba o konto: zapisana przy zamówieniu, konto powstaje dopiero po opłaceniu (fulfillOrder).
  if (createAccount) consents.push({ ...cBase, kind: "konto", text: ACCOUNT_TEXT });
  if (newsletterConsent) consents.push({ ...cBase, kind: "newsletter", text: "Chcę otrzymywać Listy powrotu — newsletter exmortis z treściami oraz informacjami o produktach i wydarzeniach — na podany adres e-mail. Zgodę mogę wycofać w każdej chwili." });
  const made = await base44.asServiceRole.entities.Consent.bulkCreate(consents);
  for (const c of made || []) await mirrorRecord(base44, "Consent", c.id);
}

// Tytuł transakcji w PayU (widoczny u klienta i w banku): „Exmortis - {produkt} ({typ})”.
const TYPE_LABEL = { pdf: "ebook", audio: "audio", wideo: "wideo", kurs: "kurs", pakiet: "pakiet", usluga: "usługa", karta: "karta podarunkowa", bilet: "bilet" };
function payuTitle(lines) {
  const first = lines[0];
  if (!first) return "Exmortis";
  const name = String(first.name || "").replace(/\s+/g, " ").trim().slice(0, 90);
  const type = TYPE_LABEL[first.type] || "";
  let t = `Exmortis - ${name}${type ? ` (${type})` : ""}`;
  const rest = lines.length - 1;
  if (rest > 0) {
    const m10 = rest % 10, m100 = rest % 100;
    const word = rest === 1 ? "inna pozycja" : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? "inne pozycje" : "innych pozycji";
    t += ` + ${rest} ${word}`;
  }
  return t;
}

export default async function (req) {
  let base44Ref = null;
  let reservedFor = null; // zamówienie, pod które zarezerwowano kod — zwalniane, gdy płatność się nie utworzy
  let createdOrderId = null; // zamówienie zapisane jako CREATING — oznaczane jako nieudane, gdy PayU odmówi
  try {
    const base44 = createClientFromRequest(req);
    base44Ref = base44;
    await loadAppUrl(base44);
    const body = await req.json().catch(() => ({}));

    // Strona powrotu z PayU pyta o stan: tylko status, po losowym numerze zamówienia (UUID), bez danych osobowych.
    if (body.action === "status") {
      const id = String(body.orderId || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ status: null });
      // Przy okazji dokańczamy zaległe kroki tego zamówienia (kolejka PayU, realizacja) — niezależnie od webhooka.
      await nudgeOrder(base44, id).catch(() => {});
      return Response.json({ status: await getOrderStatus(base44, id) });
    }

    // ===== Program POWRÓT: osobisty link do płatności z panelu (po rozmowie kwalifikacyjnej) =====
    // Podgląd: imię, kwota, ważność i wersja umowy — po tokenie z e-maila; bez adresu e-mail w odpowiedzi.
    if (body.action === "powrot.info") {
      const app = await appByPayToken(base44, body.token);
      if (!app) return Response.json({ error: "Link jest nieprawidłowy. Napisz do mnie — wyślę nowy." }, { status: 404 });
      const umowa = await docLatest(base44, "umowa_powrot");
      return Response.json({
        name: firstNameOf(app.full_name),
        amount: Number(app.pay_amount) || 0,
        expires_at: app.pay_expires_at,
        paid: isPaid(app),
        expired: !isPaid(app) && isExpired(app),
        umowa: umowa ? { version: umowa.version, date: umowa.date } : null,
      });
    }

    if (body.action === "powrot.pay") {
      if (!(await ipAllowed(base44, clientIp(req), "kasa", 20, 3600000))) {
        return Response.json({ error: TOO_MANY }, { status: 429 });
      }
      const app = await appByPayToken(base44, body.token);
      if (!app) throw validation("Link jest nieprawidłowy. Napisz do mnie — wyślę nowy.");
      if (isPaid(app)) throw validation("Ten program jest już opłacony. Potwierdzenie jest w Twojej skrzynce e-mail.");
      if (isExpired(app)) throw validation("Link wygasł. Napisz do mnie — wyślę nowy.");
      const umowa = await docLatest(base44, "umowa_powrot");
      if (!umowa) throw validation("Umowa jest chwilowo niedostępna. Napisz do mnie.");
      if (body.contract_consent !== true) throw validation("Zaakceptuj Umowę i Regulamin");
      const early = body.early_consent === true;
      const invoice = cleanInvoice(body.invoice);
      const grosze = Math.round(Number(app.pay_amount) * 100);
      if (!Number.isFinite(grosze) || grosze < 100) throw validation("Niepoprawna kwota. Napisz do mnie.");

      const payu = await getSetting(base44, "payu");
      if (!payu || !payu.posId || !payu.clientId || !payu.clientSecret || !payu.secondKey) {
        return Response.json({ error: "PAYU_NOT_CONFIGURED" }, { status: 400 });
      }
      const buyerName = String(app.full_name || "").slice(0, 100);
      const buyerEmail = String(app.email || "").toLowerCase();
      const extOrderId = crypto.randomUUID();
      const item = {
        name: PROGRAM_NAME, unitPrice: String(grosze), quantity: 1,
        kind: "powrot", powrot_app: String(app.id), service_early: early, umowa_version: umowa.version,
      };
      const note = [
        `Umowa POWRÓT, wersja ${umowa.version}`,
        early ? "Żądanie rozpoczęcia przed upływem 14 dni: TAK" : "Żądanie rozpoczęcia przed upływem 14 dni: NIE — pierwsza sesja po 14 dniach od zawarcia umowy",
        invoice ? invoiceText(invoice) : "",
      ].filter(Boolean).join("\n");

      createdOrderId = extOrderId;
      await insertCreatingOrder(base44, {
        id: extOrderId, buyerName, buyerEmail, note, invoice,
        items: [item], total: grosze / 100, newsletterConsent: false, digitalConsent: null, discountCode: null,
      });
      await runSql(base44, `UPDATE public.powrot_applications SET pay_order_id = ${escStr(extOrderId)}, updated_date = now() WHERE id::text = ${escStr(String(app.id))}`);

      const { accessToken } = await payuToken(payu);
      const realIp = clientIp(req);
      const created = await payuCreateOrder(payu, accessToken, {
        notifyUrl: `${APP_URL}/functions/payuNotification`,
        // Powrót na stronę płatności POWRÓT (sprawdza stan zamówienia) — nie do kasy Skarbca z koszykiem.
        continueUrl: `${APP_URL}/powrot/platnosc?t=${String(body.token).trim().toLowerCase()}&payu=done`,
        customerIp: realIp === "brak" ? "127.0.0.1" : realIp,
        merchantPosId: String(payu.posId),
        description: "Exmortis - Program POWRÓT (usługa)",
        currencyCode: "PLN",
        totalAmount: String(grosze),
        extOrderId,
        buyer: { email: buyerEmail, firstName: buyerName, language: "pl" },
        products: [{ name: PROGRAM_NAME, unitPrice: String(grosze), quantity: 1 }],
      });
      await attachPayuOrder(base44, extOrderId, created.payuOrderId, created.redirectUri);

      // Rejestr zgód: Umowa + Regulamin (z wersjami) i — jeśli zaznaczone — żądanie wcześniejszego rozpoczęcia.
      const cBase = { email: buyerEmail, source: "powrot:platnosc", order_id: extOrderId, ip: clientIp(req), status: "udzielona" };
      const consents = [
        { ...cBase, kind: "umowa_powrot", text: CONTRACT_CONSENT(umowa.version), doc_version: `umowa ${umowa.version}; regulamin ${await regulaminVersion(base44)}` },
        ...(early ? [{ ...cBase, kind: "usluga", text: EARLY_CONSENT, doc_version: `umowa ${umowa.version}` }] : []),
      ];
      const made = await base44.asServiceRole.entities.Consent.bulkCreate(consents);
      for (const c of made || []) await mirrorRecord(base44, "Consent", c.id);

      return Response.json({ redirectUri: created.redirectUri, orderId: extOrderId });
    }

    // Kasa jest publiczna, a każde zamówienie to dwa zapytania do PayU i wpis w bazie.
    // Limit z jednego połączenia chroni konto PayU przed zalaniem (sprawdzanie stanu zamówienia wyżej go nie dotyczy).
    if (!(await ipAllowed(base44, clientIp(req), "kasa", 20, 3600000))) {
      return Response.json({ error: TOO_MANY }, { status: 429 });
    }

    const buyerName = textField(body, "name", { max: 100 });
    const buyerEmail = emailField(body);
    const note = textField(body, "note", { max: 2000, required: false }) || "";
    const newsletterConsent = body.newsletter_consent === true;
    const createAccount = body.create_account === true;
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
    const hasDigital = rows.some((r) => DIGITAL.includes(r.product_type) || r.product_type === "pakiet");
    if (hasDigital && body.digital_consent !== true) {
      throw new Error("Zaznacz zgodę na dostarczenie treści cyfrowych");
    }
    // Usługa (sesja, pakiet sesji, płatne spotkanie, warsztat): żądanie rozpoczęcia przed upływem 14 dni (art. 15 ust. 3, art. 21 ust. 2 upk).
    const hasService = rows.some((r) => r.product_type === "usluga");
    if (hasService && body.service_consent !== true) {
      throw new Error("Zaznacz żądanie rozpoczęcia usługi");
    }

    const products = [];
    const stored = [];
    const titleLines = [];
    let totalGrosze = 0;
    for (const t of tickets) {
      totalGrosze += Number(t.unitPrice) * t.quantity;
      products.push({ name: t.name, unitPrice: t.unitPrice, quantity: t.quantity });
      stored.push(t);
      titleLines.push({ name: String(t.name || "").replace(/^Bilet — /, ""), type: "bilet" });
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
      titleLines.push({ name: String(p.name || ""), type: card ? "karta" : String(p.product_type || "") });
    }
    // Limit miejsc (kohorta, warsztat): sprzedane + płatności w toku z ostatnich 30 min — sprawdzane na serwerze.
    const need = new Map();
    for (const s of stored) {
      const pid = String(s.product_id || "");
      if (pid && !pid.startsWith("bilet:")) need.set(pid, (need.get(pid) || 0) + (Number(s.quantity) || 1));
    }
    if (need.size) {
      const seats = await productSeats(base44, [...need.keys()]);
      for (const [pid, q] of need) {
        const st = seats.get(pid);
        if (st && st.left < q) {
          const nm = String(byId.get(pid)?.name || "produkt");
          throw new Error(st.left > 0 ? `Zostało tylko ${st.left} miejsc: ${nm}` : `Brak wolnych miejsc: ${nm}`);
        }
      }
    }
    const disc = await applyDiscount(base44, body.code, stored.map((s) => ({
      product_id: s.product_id, unit: Number(s.unitPrice), qty: s.quantity,
    })), buyerEmail);
    if (disc) {
      totalGrosze -= disc.discount;
      // PayU wymaga zgodności sumy pozycji z kwotą — jedna pozycja zbiorcza.
      products.length = 0;
      products.push({ name: `EXMORTIS — zamówienie (kod ${disc.code})`, unitPrice: String(totalGrosze), quantity: 1 });
    }
    if (totalGrosze < 0) totalGrosze = 0;
    if (totalGrosze > 0 && totalGrosze < 100) throw new Error("Kwota zamówienia jest zbyt niska dla PayU");
    // Numer zamówienia od razu — pod nim rezerwujemy kod z limitem użyć (karta podarunkowa).
    const orderId = crypto.randomUUID();
    const orderNote = [note, invoice ? invoiceText(invoice) : "", disc ? `Kod rabatowy: ${disc.code} (−${(disc.discount / 100).toFixed(2)} zł)` : ""].filter(Boolean).join("\n");
    if (disc && (await reserveCode(base44, disc.record, orderId, buyerEmail))) reservedFor = orderId;

    // Zamówienie za 0 zł (np. całość pokryta kartą) — bez bramki PayU, od razu realizowane.
    if (totalGrosze === 0) {
      const id = orderId;
      const freeId = `FREE-${id}`;
      await insertOrder(base44, {
        id, payuOrderId: freeId, buyerName, buyerEmail,
        note: orderNote,
        invoice, items: stored, total: 0, status: "PENDING", newsletterConsent,
        digitalConsent: hasDigital ? DIGITAL_CONSENT : null,
        discountCode: disc ? disc.code : null,
      });
      await saveConsents(base44, req, id, buyerEmail, hasDigital, newsletterConsent, hasService, createAccount);
      if (newsletterConsent) await addSubscriber(base44, { email: buyerEmail, name: buyerName, consentGiven: true });
      // Bez bramki: zamówienie od razu opłacone; realizacja z fulfilled_at po sukcesie, a błąd ponawia zadanie cykliczne.
      await markPaid(base44, freeId);
      await fulfillPaid(base44, freeId).catch((e) => console.error("zamówienie 0 zł:", String(e?.message || e).slice(0, 200)));
      return Response.json({ redirectUri: `${APP_URL}/kasa?payu=done`, orderId: id, free: true });
    }

    const payu = await getSetting(base44, "payu");
    if (!payu || !payu.posId || !payu.clientId || !payu.clientSecret || !payu.secondKey) {
      return Response.json({ error: "PAYU_NOT_CONFIGURED" }, { status: 400 });
    }
    const extOrderId = orderId;

    // 2. Zamówienie zapisane lokalnie jako CREATING — zanim cokolwiek pójdzie do PayU.
    // Dzięki temu powiadomienie, które wyprzedzi odpowiedź bramki, ma już do czego trafić.
    createdOrderId = extOrderId;
    await insertCreatingOrder(base44, {
      id: extOrderId,
      buyerName,
      buyerEmail,
      note: orderNote,
      invoice,
      items: stored,
      total: totalGrosze / 100,
      newsletterConsent,
      digitalConsent: hasDigital ? DIGITAL_CONSENT : null,
      discountCode: disc ? disc.code : null,
    });

    // 3. Autoryzacja OAuth (formularz, nie JSON) — z limitem czasu i obsługą awarii sieci.
    const { accessToken } = await payuToken(payu);

    const realIp = clientIp(req);
    const customerIp = realIp === "brak" ? "127.0.0.1" : realIp;

    // 4. Zamówienie w PayU. HTTP 302 z JSON-em to poprawna odpowiedź, nie błąd.
    const created = await payuCreateOrder(payu, accessToken, {
      // Przez exmortis.pl (server.js → Supabase z kluczem anon): funkcja ma verify_jwt, a PayU nie wysyła tokenu.
      notifyUrl: `${APP_URL}/functions/payuNotification`,
      continueUrl: `${APP_URL}/kasa?payu=done`,
      customerIp,
      merchantPosId: String(payu.posId),
      description: payuTitle(titleLines),
      currencyCode: "PLN",
      totalAmount: String(totalGrosze),
      extOrderId,
      buyer: { email: buyerEmail, firstName: buyerName.slice(0, 100), language: "pl" },
      products,
    });

    // 5. Identyfikator PayU i adres płatności przy zamówieniu; status PENDING.
    await attachPayuOrder(base44, extOrderId, created.payuOrderId, created.redirectUri);

    await saveConsents(base44, req, extOrderId, buyerEmail, hasDigital, newsletterConsent, hasService, createAccount);

    // Licznik użyć kodu rośnie dopiero po opłaceniu (payuNotification).

    if (newsletterConsent) {
      await addSubscriber(base44, { email: buyerEmail, name: buyerName, consentGiven: true });
    }

    // 6. Klient idzie do PayU; realizacja dopiero po podpisanym powiadomieniu COMPLETED.
    return Response.json({ redirectUri: created.redirectUri, orderId: extOrderId, payuOrderId: created.payuOrderId });
  } catch (error) {
    if (reservedFor) await releaseCode(base44Ref, reservedFor);
    // Zamówienie zapisane jako CREATING, ale płatność nie powstała — nie zostawiamy go w zawieszeniu.
    if (createdOrderId && base44Ref) await markOrderFailed(base44Ref, createdOrderId);
    // Błąd walidacji formularza = 400 (komunikat dla klienta); reszta (baza, PayU) = generyczna 500,
    // szczegóły tylko w logach (audyt W1: bez wycieku surowego tekstu błędu).
    return errorResponse(error, "Nie udało się rozpocząć płatności. Spróbuj ponownie.");
  }
}