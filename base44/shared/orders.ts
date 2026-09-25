import { runSql, escStr, esc } from "./supabase.ts";

// Zamówienia z kasy (PayU) — tabela public.orders.

export async function ensureOrdersTable(base44) {
  await runSql(
    base44,
    `CREATE TABLE IF NOT EXISTS public.orders (
      id text PRIMARY KEY,
      payu_order_id text,
      buyer_name text,
      buyer_email text,
      note text,
      items jsonb NOT NULL,
      total numeric NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'NEW',
      created_date timestamptz DEFAULT now(),
      updated_date timestamptz DEFAULT now()
    )`
  );
  await runSql(
    base44,
    `ALTER TABLE public.orders
       ADD COLUMN IF NOT EXISTS buyer_phone text,
       ADD COLUMN IF NOT EXISTS phone_consent_date timestamptz,
       ADD COLUMN IF NOT EXISTS newsletter_consent_date timestamptz`
  );
}

export async function insertOrder(base44, order) {
  await ensureOrdersTable(base44);
  const itemsJson = JSON.stringify(order.items);
  await runSql(
    base44,
    `INSERT INTO public.orders
       (id, payu_order_id, buyer_name, buyer_email, buyer_phone, note, items, total, status,
        phone_consent_date, newsletter_consent_date)
     VALUES (${escStr(order.id)}, ${escStr(order.payuOrderId || "")}, ${escStr(order.buyerName || "")},
             ${escStr(order.buyerEmail || "")},
             ${order.buyerPhone ? escStr(order.buyerPhone) : "NULL"},
             ${escStr(order.note || "")},
             ${escStr(itemsJson)}::jsonb, ${esc(order.total)}, ${escStr(order.status)},
             ${order.phoneConsent ? "now()" : "NULL"},
             ${order.newsletterConsent ? "now()" : "NULL"})`
  );
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

export async function updateOrderStatus(base44, payuOrderId, status) {
  await runSql(
    base44,
    `UPDATE public.orders
     SET status = ${escStr(status)}, updated_date = now()
     WHERE payu_order_id = ${escStr(payuOrderId)}`
  );
}