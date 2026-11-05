// Kolejka powiadomień PayU i realizacja opłaconych zamówień (5.11.2026).
// Wersja bliźniacza: base44/shared/payuQueue.ts i supabase/functions/_shared/payuQueue.ts — zmieniać obie naraz.
//
// Zasady:
//  - każde zweryfikowane (podpisane) powiadomienie trafia najpierw do public.payu_events — trwały zapis,
//    klucz = numer zamówienia PayU + status, więc powtórki PayU nie tworzą duplikatów;
//  - przetwarzanie jest idempotentne i ponawiane z rosnącym odstępem (1 min … 6 h): przy każdym powiadomieniu,
//    przy sprawdzaniu stanu przez stronę powrotu z PayU i w zadaniu cyklicznym cmsScheduled. Zdarzenie nie znika
//    po kilku próbach; bez pasującego zamówienia przestaje być ponawiane dopiero po 7 dniach i zostaje w tabeli;
//  - płatność (status COMPLETED) i realizacja (fulfilled_at) są rozdzielone: fulfilled_at zapisujemy dopiero
//    po skutecznej realizacji, a nieudaną realizację ponawiamy (blokada fulfill_lock_at chroni przed równoległym wykonaniem);
//  - COMPLETED uznajemy wyłącznie przy zgodnej kwocie, walucie (PLN), POS i numerze zamówienia.
// Struktury tabel zakłada migracja docs/tech/migracje/2026-11-05_payu.sql — tu nie ma żadnego DDL.
import { runSql, escStr } from "./supabase.ts";
import { getSetting } from "./settings.ts";
import { findOrderForNotification, updateOrderStatus } from "./orders.ts";
import { fulfillOrder } from "./fulfillOrder.ts";
import { localPayuStatus } from "./payu.ts";
import { sendMail, adminTo } from "./smtp.ts";

const LEASE_MIN = 5;      // na tyle minut zdarzenie jest „wzięte” przez jedno wywołanie
const LOCK_MIN = 10;      // blokada realizacji; po awarii wywołania przejmuje ją kolejne po 10 minutach
const GIVE_UP_DAYS = 7;   // zdarzenie bez pasującego zamówienia przestaje być ponawiane po 7 dniach
const MAX_FULFILL_TRIES = 48;

const msg = (e) => String(e?.message || e || "").slice(0, 300);
// Kolejna próba: 1, 2, 4 … minut, najwyżej 6 godzin.
const backoff = (tries) => `now() + make_interval(mins => LEAST(360, power(2, LEAST(${Math.max(0, Number(tries) || 0)}, 9))::int))`;

// ---------- zamówienie: płatność i realizacja ----------

// Płatność potwierdzona. Idempotentne: zamówienie już opłacone zostaje opłacone; anulowanego nie zmieniamy.
export async function markPaid(base44, payuOrderId) {
  const rows = await runSql(base44, `UPDATE public.orders
     SET status = 'COMPLETED', payu_status = 'COMPLETED', updated_date = now()
     WHERE payu_order_id = ${escStr(payuOrderId)} AND status NOT IN ('COMPLETED', 'CANCELED')
     RETURNING id`);
  return Array.isArray(rows) && rows.length > 0;
}

// Przejęcie realizacji: tylko jedno wywołanie dostaje zamówienie opłacone i jeszcze niezrealizowane.
async function claimFulfillment(base44, payuOrderId) {
  const rows = await runSql(base44, `UPDATE public.orders
     SET fulfill_lock_at = now(), fulfill_tries = COALESCE(fulfill_tries, 0) + 1
     WHERE payu_order_id = ${escStr(payuOrderId)} AND status = 'COMPLETED' AND fulfilled_at IS NULL
       AND (fulfill_lock_at IS NULL OR fulfill_lock_at < now() - interval '${LOCK_MIN} minutes')
     RETURNING *`);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

// Realizacja zamówienia opłaconego: dostęp, karty, bilety, kod, maile. fulfilled_at dopiero po sukcesie.
// Każdy krok realizacji jest idempotentny (dostęp i karty po numerze zamówienia, bilety po pozycji), więc
// ponowienie po awarii dopełnia tylko brakujące elementy.
export async function fulfillPaid(base44, payuOrderId) {
  const order = await claimFulfillment(base44, payuOrderId);
  if (!order) return { fulfilled: false, skipped: true };
  try {
    await fulfillOrder(base44, order, payuOrderId);
  } catch (e) {
    await runSql(base44, `UPDATE public.orders SET fulfill_lock_at = NULL, fulfill_error = ${escStr(msg(e))}
       WHERE id = ${escStr(order.id)} AND fulfilled_at IS NULL`).catch(() => {});
    throw e;
  }
  await runSql(base44, `UPDATE public.orders SET fulfilled_at = now(), fulfill_lock_at = NULL, fulfill_error = NULL, updated_date = now()
     WHERE id = ${escStr(order.id)}`);
  return { fulfilled: true };
}

// Opłacone, ale niezrealizowane (awaria w trakcie realizacji) — ponawiane z zadania cyklicznego i przy sprawdzaniu stanu.
export async function retryUnfulfilled(base44, limit = 3) {
  const rows = await runSql(base44, `SELECT payu_order_id FROM public.orders
     WHERE status = 'COMPLETED' AND fulfilled_at IS NULL AND COALESCE(payu_order_id, '') <> ''
       AND COALESCE(payu_status, '') <> 'MISMATCH'
       AND (fulfill_lock_at IS NULL OR fulfill_lock_at < now() - interval '${LOCK_MIN} minutes')
       AND COALESCE(fulfill_tries, 0) < ${MAX_FULFILL_TRIES}
       AND created_date > now() - interval '14 days'
     ORDER BY updated_date LIMIT ${Math.max(1, Number(limit) || 3)}`, true).catch(() => []);
  let done = 0;
  for (const r of rows || []) {
    try {
      if ((await fulfillPaid(base44, r.payu_order_id)).fulfilled) done++;
    } catch (e) {
      console.error("realizacja zamówienia:", msg(e));
    }
  }
  return done;
}

// ---------- weryfikacja płatności ----------

export function paymentMismatch(order, stored, payu) {
  const want = Math.round(Number(stored?.total || 0) * 100);
  const got = Number(order?.totalAmount);
  if (!Number.isFinite(got) || got !== want) return `kwota ${order?.totalAmount ?? "brak"} ≠ ${want} gr`;
  if (String(order?.currencyCode || "").toUpperCase() !== "PLN") return `waluta ${order?.currencyCode || "brak"}`;
  if (!payu?.posId || String(order?.merchantPosId || "") !== String(payu.posId)) return "inny POS";
  if (order?.extOrderId && String(order.extOrderId) !== String(stored?.id)) return "inny numer zamówienia";
  return null;
}

async function reportMismatch(base44, stored, payuOrderId, reason) {
  await runSql(base44, `UPDATE public.orders SET payu_status = 'MISMATCH', fulfill_error = ${escStr(`Płatność niezgodna: ${reason}`)}
     WHERE id = ${escStr(stored.id)}`).catch(() => {});
  try {
    const to = await adminTo(base44);
    if (to) {
      await sendMail(base44, {
        kind: "platnosc_niezgodna", ref: stored.id, to,
        subject: "EXMORTIS — płatność PayU niezgodna z zamówieniem",
        html: `<p>Powiadomienie PayU o zakończonej płatności nie zgadza się z zamówieniem — zamówienie NIE zostało zrealizowane.</p>
          <p>Powód: ${String(reason).replace(/</g, "&lt;")}</p><p>Zamówienie: ${String(stored.id).slice(0, 8).toUpperCase()} · PayU: ${String(payuOrderId).replace(/</g, "&lt;")}</p>
          <p>Sprawdź płatność w panelu PayU (Panel → Zamówienia).</p>`,
      });
    }
  } catch { /* informacja dla admina nie blokuje kolejki */ }
}

// ---------- kolejka powiadomień ----------

async function recordEvent(base44, order) {
  const payuOrderId = String(order?.orderId || "");
  const status = String(order?.status || "").toUpperCase();
  const id = `${payuOrderId}:${status}`;
  const rows = await runSql(base44, `INSERT INTO public.payu_events
       (id, payu_order_id, ext_order_id, payu_status, payload, received_at, next_attempt_at, tries)
     VALUES (${escStr(id)}, ${escStr(payuOrderId)}, ${escStr(String(order?.extOrderId || ""))}, ${escStr(status)},
             ${escStr(JSON.stringify({ order }))}::jsonb, now(), now(), 0)
     ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, next_attempt_at = now()
       WHERE public.payu_events.processed_at IS NULL
     RETURNING id`);
  return { id, open: Array.isArray(rows) && rows.length > 0 };
}

const LEASE_SET = `next_attempt_at = now() + interval '${LEASE_MIN} minutes', tries = COALESCE(tries, 0) + 1`;

async function leaseEvent(base44, id) {
  const rows = await runSql(base44, `UPDATE public.payu_events SET ${LEASE_SET}
     WHERE id = ${escStr(id)} AND processed_at IS NULL AND COALESCE(next_attempt_at, received_at) <= now()
     RETURNING *`);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function leaseDue(base44, limit, where = "TRUE") {
  const rows = await runSql(base44, `UPDATE public.payu_events SET ${LEASE_SET}
     WHERE id IN (SELECT id FROM public.payu_events
       WHERE processed_at IS NULL AND COALESCE(next_attempt_at, received_at) <= now() AND ${where}
       ORDER BY received_at LIMIT ${Math.max(1, Number(limit) || 5)} FOR UPDATE SKIP LOCKED)
     RETURNING *`).catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

async function closeEvent(base44, id, result) {
  await runSql(base44, `UPDATE public.payu_events SET processed_at = now(), result = ${escStr(String(result).slice(0, 200))}, last_error = NULL
     WHERE id = ${escStr(id)}`);
}

async function retryEvent(base44, ev, error) {
  const tooOld = ev?.received_at && Date.parse(ev.received_at) < Date.now() - GIVE_UP_DAYS * 86400000;
  if (tooOld && error === "brak zamówienia") {
    await closeEvent(base44, ev.id, `porzucone po ${GIVE_UP_DAYS} dniach: brak zamówienia`).catch(() => {});
    return;
  }
  await runSql(base44, `UPDATE public.payu_events SET last_error = ${escStr(String(error).slice(0, 300))}, next_attempt_at = ${backoff(ev?.tries)}
     WHERE id = ${escStr(ev.id)} AND processed_at IS NULL`).catch(() => {});
}

// Przetworzenie jednego (wziętego) zdarzenia. Rzuca przy błędzie bazy — wtedy zdarzenie wraca do kolejki.
async function processEvent(base44, ev, payu) {
  const order = ev.payload?.order || {};
  const payuOrderId = String(order.orderId || ev.payu_order_id || "");
  const status = String(order.status || ev.payu_status || "").toUpperCase();
  if (!payuOrderId || !status) {
    await closeEvent(base44, ev.id, "pominięte: brak numeru lub statusu");
    return { skipped: true };
  }
  const stored = await findOrderForNotification(base44, payuOrderId, String(order.extOrderId || ev.ext_order_id || ""));
  if (!stored) {
    await retryEvent(base44, ev, "brak zamówienia");
    return { stored: false, queued: true };
  }
  const local = localPayuStatus(status);
  if (local !== "COMPLETED") {
    await updateOrderStatus(base44, payuOrderId, local, status);
    await closeEvent(base44, ev.id, `status ${local}`);
    return { stored: true, status: local };
  }
  const bad = paymentMismatch(order, stored, payu);
  if (bad) {
    await reportMismatch(base44, stored, payuOrderId, bad);
    await closeEvent(base44, ev.id, `niezgodność: ${bad}`);
    return { stored: true, mismatch: true };
  }
  const paid = await markPaid(base44, payuOrderId);
  if (!paid && stored.status === "CANCELED") {
    // PayU zakończyło płatność zamówienia, które u nas jest anulowane — pieniądze są, realizacji nie było.
    await reportMismatch(base44, stored, payuOrderId, "płatność zakończona dla zamówienia anulowanego");
    await closeEvent(base44, ev.id, "niezgodność: zamówienie anulowane");
    return { stored: true, mismatch: true };
  }
  await closeEvent(base44, ev.id, "opłacone");
  // Realizacja osobno: jej błąd nie cofa płatności, tylko zostawia fulfilled_at puste do ponowienia.
  try {
    const f = await fulfillPaid(base44, payuOrderId);
    return { stored: true, status: "COMPLETED", fulfilled: f.fulfilled };
  } catch (e) {
    console.error("realizacja zamówienia:", msg(e));
    return { stored: true, status: "COMPLETED", fulfilled: false };
  }
}

async function runLeased(base44, ev, payu) {
  try {
    return await processEvent(base44, ev, payu);
  } catch (e) {
    await retryEvent(base44, ev, msg(e));
    throw e;
  }
}

// Powiadomienie z webhooka (podpis już sprawdzony): trwały zapis, potem próba przetworzenia.
export async function handleNotification(base44, payu, order) {
  const rec = await recordEvent(base44, order);
  if (!rec.open) return { duplicate: true };
  const ev = await leaseEvent(base44, rec.id);
  if (!ev) return { queued: true };
  return runLeased(base44, ev, payu);
}

// Zaległe zdarzenia — z zadania cyklicznego, z webhooka (po bieżącym) i przy sprawdzaniu stanu zamówienia.
export async function drainPayuEvents(base44, limit = 5, where = "TRUE") {
  const due = await leaseDue(base44, limit, where);
  if (!due.length) return 0;
  const payu = await getSetting(base44, "payu").catch(() => null);
  let n = 0;
  for (const ev of due) {
    try { await runLeased(base44, ev, payu); n++; } catch (e) { console.error("kolejka PayU:", msg(e)); }
  }
  return n;
}

// Strona powrotu z PayU pyta o stan zamówienia — przy okazji dokańczamy zaległe kroki tego jednego zamówienia.
export async function nudgeOrder(base44, id) {
  const rows = await runSql(base44, `SELECT status, payu_order_id, fulfilled_at FROM public.orders WHERE id = ${escStr(id)} LIMIT 1`, true);
  const o = rows && rows[0];
  if (!o) return;
  const pid = String(o.payu_order_id || "");
  if (o.status !== "COMPLETED" && o.status !== "CANCELED") {
    await drainPayuEvents(base44, 3, `(ext_order_id = ${escStr(id)}${pid ? ` OR payu_order_id = ${escStr(pid)}` : ""})`);
  } else if (o.status === "COMPLETED" && !o.fulfilled_at && pid) {
    await fulfillPaid(base44, pid).catch((e) => console.error("realizacja zamówienia:", msg(e)));
  }
}
