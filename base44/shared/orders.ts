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
     CREATE INDEX IF NOT EXISTS orders_updated_idx ON public.orders (updated_date)`
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
  await ensureOrdersTable(base44);
  const rows = await runSql(
    base44,
    `SELECT * FROM public.orders WHERE payu_order_id = ${escStr(payuOrderId)} LIMIT 1`,
    true
  );
  return rows && rows.length > 0 ? rows[0] : null;
}

// COMPLETED i CANCELED są końcowe — spóźnione powiadomienie (np. PENDING po COMPLETED) ich nie cofa.
export async function updateOrderStatus(base44, payuOrderId, status) {
  await runSql(
    base44,
    `UPDATE public.orders
     SET status = ${escStr(status)}, updated_date = now()
     WHERE payu_order_id = ${escStr(payuOrderId)} AND status NOT IN ('COMPLETED', 'CANCELED')`
  );
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
  return Array.isArray(rows) && rows.length > 0;
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