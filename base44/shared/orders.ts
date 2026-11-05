import { runSql, escStr, esc } from "./supabase.ts";

// Zamówienia z kasy (PayU) — tabela public.orders.

// Struktura tabeli zakładana migracją przy wdrożeniu — przy zapytaniach nic nie zmieniamy.
// Indeksy natomiast zakładamy tu: tabela rośnie, a bez nich każde powiadomienie PayU (payu_order_id),
// konto i opinie (e-mail), lista i statystyki w panelu (status, data) oraz ponowienia faktur
// (updated_date) przechodzą przez całą tabelę. Raz na instancję; po pierwszym razie to no-op.
let ORDERS_IDX = false;
export async function ensureOrdersTable(base44) {
  if (ORDERS_IDX) return;
  ORDERS_IDX = true;
  await runSql(
    base44,
    `CREATE INDEX IF NOT EXISTS orders_payu_idx ON public.orders (payu_order_id);
     CREATE INDEX IF NOT EXISTS orders_email_idx ON public.orders (lower(buyer_email));
     CREATE INDEX IF NOT EXISTS orders_status_created_idx ON public.orders (status, created_date DESC);
     CREATE INDEX IF NOT EXISTS orders_updated_idx ON public.orders (updated_date);
     ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payu_status text;
     ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS redirect_uri text;
     ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfilled_at timestamptz;
     CREATE TABLE IF NOT EXISTS public.payu_events (
       id text PRIMARY KEY,
       payu_order_id text,
       ext_order_id text,
       payu_status text,
       payload jsonb,
       received_at timestamptz DEFAULT now(),
       processed_at timestamptz,
       tries int DEFAULT 0,
       last_error text
     );
     CREATE INDEX IF NOT EXISTS payu_events_pending_idx ON public.payu_events (processed_at)`
  ).catch(() => {});
}

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
  // Surowy status PayU trzymamy osobno od statusu zamówienia (kolumna może nie istnieć na starej bazie).
  if (payuStatus) {
    await runSql(
      base44,
      `UPDATE public.orders SET payu_status = ${escStr(payuStatus)} WHERE payu_order_id = ${escStr(payuOrderId)}`
    ).catch(() => {});
  }
}

// Atomowe przejęcie pierwszego COMPLETED: tylko jedno wywołanie dostaje wiersz (równoległe i ponowione powiadomienia — nic).
export async function claimCompletion(base44, payuOrderId) {
  const rows = await runSql(
    base44,
    `UPDATE public.orders
     SET status = 'COMPLETED', updated_date = now()
     WHERE payu_order_id = ${escStr(payuOrderId)} AND status NOT IN ('COMPLETED', 'CANCELED')
     RETURNING id`
  );
  const claimed = Array.isArray(rows) && rows.length > 0;
  // Znacznik realizacji niezależny od statusu płatności — widać, że dostęp/bilety już wydane.
  if (claimed) {
    await runSql(
      base44,
      `UPDATE public.orders SET payu_status = 'COMPLETED', fulfilled_at = COALESCE(fulfilled_at, now())
       WHERE payu_order_id = ${escStr(payuOrderId)}`
    ).catch(() => {});
  }
  return claimed;
}

// Cofnięcie przejęcia, gdy obsługa się nie udała — PayU ponówi powiadomienie.
export async function releaseCompletion(base44, payuOrderId, previous) {
  await runSql(
    base44,
    `UPDATE public.orders SET status = ${escStr(previous || "PENDING")}, updated_date = now()
     WHERE payu_order_id = ${escStr(payuOrderId)} AND status = 'COMPLETED'`
  );
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

// Zdarzenie zapisane trwale, gdy zamówienia jeszcze nie ma — do przetworzenia przy kolejnym powiadomieniu.
export async function recordPayuEvent(base44, { payuOrderId, extOrderId, payuStatus, order }) {
  const id = crypto.randomUUID();
  await runSql(
    base44,
    `INSERT INTO public.payu_events (id, payu_order_id, ext_order_id, payu_status, payload)
     VALUES (${escStr(id)}, ${escStr(payuOrderId || "")}, ${escStr(extOrderId || "")}, ${escStr(payuStatus || "")},
             ${escStr(JSON.stringify({ order: order || null }))}::jsonb)`
  );
  return id;
}

export async function pendingPayuEvents(base44, limit = 5) {
  const rows = await runSql(
    base44,
    `SELECT * FROM public.payu_events
     WHERE processed_at IS NULL ORDER BY received_at LIMIT ${Math.max(1, Number(limit) || 5)}`,
    true
  ).catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

// Zamówienia, które utknęły jako CREATING (kasa przerwana przed odpowiedzią PayU) — po 15 minutach
// zamykamy je jako FAILED. Późne powiadomienie i tak je dokończy (claimCompletion dopuszcza FAILED).
export async function expireStaleCreating(base44) {
  const rows = await runSql(
    base44,
    `UPDATE public.orders SET status = 'FAILED', updated_date = now()
     WHERE status = 'CREATING' AND created_date < now() - interval '15 minutes' RETURNING id`
  ).catch(() => []);
  return Array.isArray(rows) ? rows.length : 0;
}

// Zdarzenie uznajemy za domknięte po przetworzeniu; przy błędzie wraca do kolejki (najwyżej 3 podejścia).
export async function closePayuEvent(base44, id, error = null) {
  await runSql(
    base44,
    `UPDATE public.payu_events
     SET processed_at = CASE WHEN ${error ? "true" : "false"} AND COALESCE(tries, 0) < 2 THEN NULL ELSE now() END,
         tries = COALESCE(tries, 0) + 1,
         last_error = ${escStr(error || "")}
     WHERE id = ${escStr(id)}`
  ).catch(() => {});
}