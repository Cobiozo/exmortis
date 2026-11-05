import { runSql, escStr, esc } from "./supabase.ts";

// Zamówienia z kasy (PayU) — tabela public.orders.

// Struktura tabel płatności (kolumny payu_status, redirect_uri, fulfilled_at, fulfill_*, indeksy, tabela payu_events)
// zakładana jest wyłącznie migracją docs/tech/migracje/2026-11-05_payu.sql. Obsługa płatności nie wykonuje DDL.
export async function ensureOrdersTable(_base44) {}

export async function insertOrder(base44, order) {
  await ensureOrdersTable(base44);
  const itemsJson = JSON.stringify(order.items);
  await runSql(
    base44,
    `INSERT INTO public.orders
       (id, payu_order_id, buyer_name, buyer_email, buyer_phone, note, items, total, status,
        phone_consent_date, newsletter_consent_date, digital_consent_text, digital_consent_date)
     VALUES (${escStr(order.id)}, ${escStr(order.payuOrderId || "")}, ${escStr(order.buyerName || "")},
             ${escStr(order.buyerEmail || "")},
             ${order.buyerPhone ? escStr(order.buyerPhone) : "NULL"},
             ${escStr(order.note || "")},
             ${escStr(itemsJson)}::jsonb, ${esc(order.total)}, ${escStr(order.status)},
             ${order.phoneConsent ? "now()" : "NULL"},
             ${order.newsletterConsent ? "now()" : "NULL"},
             ${order.digitalConsent ? escStr(order.digitalConsent) : "NULL"},
             ${order.digitalConsent ? "now()" : "NULL"})`
  );
  // Dane do faktury osobno: brak kolumny / błąd nie psuje zamówienia (tekst i tak jest w notatce).
  if (order.invoice) {
    try {
      if (await ensureInvoiceColumn(base44)) {
        await runSql(base44, `UPDATE public.orders SET invoice = ${escStr(JSON.stringify(order.invoice))}::jsonb WHERE id = ${escStr(order.id)}`);
      }
    } catch {
      // zostaje zapis w notatce
    }
  }
  // Kod rabatowy zapisany wprost. Nie wolno go odczytywać z notatki: notatkę wpisuje kupujący,
  // więc mógłby w niej podać cudzy kod karty podarunkowej i wypalić go bez zakupu.
  if (order.discountCode) {
    try {
      await ensureDiscountColumn(base44);
      await runSql(base44, `UPDATE public.orders SET discount_code = ${escStr(order.discountCode)} WHERE id = ${escStr(order.id)}`);
    } catch {
      // brak kolumny nie psuje zamówienia
    }
  }
}

// Kolumna „invoice” zakładana przy pierwszym zamówieniu z fakturą (sprawdzenie bez blokowania tabeli).
let INVOICE_COL = false;
export async function ensureInvoiceColumn(base44) {
  if (INVOICE_COL) return true;
  const has = await runSql(base44, `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'invoice'`, true);
  if (!(Array.isArray(has) && has.length)) await runSql(base44, `ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice jsonb`);
  INVOICE_COL = true;
  return true;
}

// Kolumna „discount_code” zakładana przy pierwszym zamówieniu z kodem rabatowym.
let DISCOUNT_COL = false;
export async function ensureDiscountColumn(base44) {
  if (DISCOUNT_COL) return true;
  const has = await runSql(base44, `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'discount_code'`, true);
  if (!(Array.isArray(has) && has.length)) await runSql(base44, `ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_code text`);
  DISCOUNT_COL = true;
  return true;
}

export async function getOrderByPayuId(base44, payuOrderId) {
  // Pusty identyfikator nie może dopasować zamówień zapisanych jako CREATING (bez numeru PayU).
  if (!String(payuOrderId || "").trim()) return null;
  await ensureOrdersTable(base44);
  const rows = await runSql(
    base44,
    `SELECT * FROM public.orders WHERE payu_order_id = ${escStr(payuOrderId)} LIMIT 1`,
    true
  );
  return rows && rows.length > 0 ? rows[0] : null;
}

// COMPLETED i CANCELED są końcowe — spóźnione powiadomienie (np. PENDING po COMPLETED) ich nie cofa.
export async function updateOrderStatus(base44, payuOrderId, status, payuStatus = null) {
  await runSql(
    base44,
    `UPDATE public.orders
     SET status = ${escStr(status)}, updated_date = now()
     WHERE payu_order_id = ${escStr(payuOrderId)} AND status NOT IN ('COMPLETED', 'CANCELED')`
  );
  // Surowy status PayU trzymamy osobno od statusu zamówienia.
  if (payuStatus) {
    await runSql(
      base44,
      `UPDATE public.orders SET payu_status = ${escStr(payuStatus)} WHERE payu_order_id = ${escStr(payuOrderId)}`
    ).catch(() => {});
  }
}

export async function getOrderStatus(base44, id) {
  const rows = await runSql(base44, `SELECT status FROM public.orders WHERE id = ${escStr(id)} LIMIT 1`, true);
  return rows && rows.length ? String(rows[0].status || "") : null;
}

// === Kolejność zapisu: CREATING → PENDING → COMPLETED ===

// Zamówienie zapisane PRZED kontaktem z PayU — po awarii wiadomo, że próba była.
export async function insertCreatingOrder(base44, order) {
  await insertOrder(base44, { ...order, status: "CREATING", payuOrderId: "" });
}

// Identyfikator PayU i adres płatności dopisane po utworzeniu zamówienia w PayU.
export async function attachPayuOrder(base44, id, payuOrderId, redirectUri) {
  await runSql(
    base44,
    `UPDATE public.orders
     SET payu_order_id = ${escStr(payuOrderId)}, status = 'PENDING', updated_date = now()
     WHERE id = ${escStr(id)} AND status = 'CREATING'`
  );
  await runSql(
    base44,
    `UPDATE public.orders SET payu_status = 'PENDING', redirect_uri = ${escStr(redirectUri)}
     WHERE id = ${escStr(id)}`
  ).catch(() => {});
}

// Nieudane utworzenie płatności — zamówienie nie zawisa w „CREATING”.
export async function markOrderFailed(base44, id) {
  await runSql(
    base44,
    `UPDATE public.orders SET status = 'FAILED', updated_date = now()
     WHERE id = ${escStr(id)} AND status = 'CREATING'`
  ).catch(() => {});
}

// Zamówienie dla powiadomienia: po identyfikatorze PayU, a gdy ten jeszcze nie został zapisany — po extOrderId.
export async function findOrderForNotification(base44, payuOrderId, extOrderId) {
  const byPayu = payuOrderId ? await getOrderByPayuId(base44, payuOrderId) : null;
  if (byPayu) return byPayu;
  if (!extOrderId) return null;
  const rows = await runSql(base44, `SELECT * FROM public.orders WHERE id = ${escStr(extOrderId)} LIMIT 1`, true);
  const found = rows && rows.length ? rows[0] : null;
  if (!found) return null;
  // Powiadomienie wyprzedziło zapis — dopisujemy identyfikator PayU.
  if (payuOrderId && !String(found.payu_order_id || "").trim()) {
    await runSql(
      base44,
      `UPDATE public.orders SET payu_order_id = ${escStr(payuOrderId)}, updated_date = now()
       WHERE id = ${escStr(extOrderId)} AND COALESCE(payu_order_id, '') = ''`
    ).catch(() => {});
    found.payu_order_id = payuOrderId;
  }
  return found;
}

// Zamówienia, które utknęły jako CREATING (kasa przerwana przed odpowiedzią PayU) — po 15 minutach
// zamykamy je jako FAILED. Późne powiadomienie COMPLETED i tak je opłaci (markPaid dopuszcza FAILED).
export async function expireStaleCreating(base44) {
  const rows = await runSql(
    base44,
    `UPDATE public.orders SET status = 'FAILED', updated_date = now()
     WHERE status = 'CREATING' AND created_date < now() - interval '15 minutes' RETURNING id`
  ).catch(() => []);
  return Array.isArray(rows) ? rows.length : 0;
}
