import fs from "node:fs";
import { db, sqlLog } from "./mocks/db.mjs";
import { mails } from "./mocks/smtp.mjs";
import { calls } from "./mocks/fulfill.mjs";

let ok = 0, bad = 0;
const t = async (name, fn) => { try { await fn(); ok++; console.log("  OK   " + name); } catch (e) { bad++; console.log("  BŁĄD " + name + " — " + (e?.message || e)); } };
const eq = (a, b, m = "") => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} oczekiwano ${JSON.stringify(b)}, jest ${JSON.stringify(a)}`); };
const one = async (q) => (await db.query(q)).rows[0];
const asRole = async (role, q) => { await db.exec(`SET ROLE ${role}`); try { return await db.query(q); } finally { await db.exec("RESET ROLE"); } };

console.log("1) MIGRACJA");
await db.exec(fs.readFileSync("setup.sql", "utf8"));
const MIG = fs.readFileSync("migration.sql", "utf8");
await t("migracja przechodzi (1. uruchomienie)", async () => { await db.exec(MIG); });
const snap1 = JSON.stringify((await db.query("SELECT id, fulfilled_at, fulfill_review, fulfill_tries FROM public.orders ORDER BY id")).rows);
await t("migracja idempotentna (2. uruchomienie bez zmian danych)", async () => {
  await db.exec(MIG);
  eq(JSON.stringify((await db.query("SELECT id, fulfilled_at, fulfill_review, fulfill_tries FROM public.orders ORDER BY id")).rows), snap1);
});
await t("kolumny orders (15 nowych/wymaganych)", async () => {
  const r = await db.query(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name IN
    ('payu_status','redirect_uri','fulfilled_at','fulfill_lock_at','fulfill_tries','fulfill_error','fulfill_alerted_at','fulfill_review','is_test',
     'invoice','invoice_id','invoice_number','invoice_url','invoice_at','invoice_error')`);
  eq(r.rows[0].n, 15);
});
await t("order_refunds.correction_* (4)", async () => eq((await one(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name='order_refunds' AND column_name LIKE 'correction_%'`)).n, 4));
await t("historyczne: A i B potwierdzone (fulfilled_at), C do ręcznej weryfikacji", async () => {
  const r = (await db.query(`SELECT left(id,1) AS k, fulfilled_at IS NOT NULL AS f, left(COALESCE(fulfill_review,''),9) AS rv, fulfill_tries FROM public.orders WHERE status='COMPLETED' ORDER BY id`)).rows;
  eq(r.map((x) => [x.k, x.f, x.rv, x.fulfill_tries >= 9999]), [["a", true, "migracja ", false], ["b", true, "migracja ", false], ["c", false, "DO RĘCZNE", true]]);
});
await t("FREE (12) nietknięte", async () => eq((await one(`SELECT count(*)::int AS n FROM public.orders WHERE status='FREE' AND fulfilled_at IS NULL AND fulfill_review IS NULL`)).n, 12));
await t("kopia backup = liczba zamówień, bez dostępu anon", async () => {
  eq((await one(`SELECT (SELECT count(*) FROM public.orders) = (SELECT count(*) FROM backup.orders_przed_payu_20261105) AS ok`)).ok, true);
  eq((await one(`SELECT has_schema_privilege('anon','backup','USAGE') AS u`)).u, false);
});
await t("RLS: payu_events włączone, anon/authenticated bez praw, service_role ma", async () => {
  eq((await one(`SELECT relrowsecurity AS r FROM pg_class WHERE oid='public.payu_events'::regclass`)).r, true);
  eq((await one(`SELECT has_table_privilege('anon','public.payu_events','SELECT') a, has_table_privilege('authenticated','public.payu_events','INSERT') b, has_table_privilege('service_role','public.payu_events','UPDATE') c`)), { a: false, b: false, c: true });
});
await t("RLS: anon nie czyta payu_events ani orders (odmowa lub 0 wierszy)", async () => {
  let denied = false; try { await asRole("anon", "SELECT * FROM public.payu_events"); } catch { denied = true; }
  eq(denied, true, "payu_events");
  const r = await asRole("anon", "SELECT count(*)::int AS n FROM public.orders"); eq(r.rows[0].n, 0, "orders (RLS bez polityk)");
});
await t("discount_reservations + exm_reserve_code bez EXECUTE dla anon", async () => {
  eq((await one(`SELECT relrowsecurity AS r FROM pg_class WHERE oid='public.discount_reservations'::regclass`)).r, true);
  eq((await one(`SELECT has_function_privilege('anon','public.exm_reserve_code(text,text,text,int)','EXECUTE') AS e`)).e, false);
  eq((await one(`SELECT public.exm_reserve_code('KOD1','o1','x@y',1) AS ok`)).ok, true);
  eq((await one(`SELECT public.exm_reserve_code('KOD1','o2','z@y',1) AS ok`)).ok, false);
});

console.log("2) KOLEJKA PayU, REALIZACJA, ALERTY, WZNOWIENIE");
const Q = await import("./out/q.mjs");
const O = await import("./out/o.mjs");
const PAYU = { posId: "1234567", clientId: "1234567", clientSecret: "x".repeat(32), secondKey: "y".repeat(32), env: "sandbox" };
globalThis.__settings = { payu: PAYU };
let remote = {};   // stan zamówień „w PayU” dla payuGetOrder
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes("/oauth/authorize")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 43199 }), { status: 200 });
  const m = u.match(/\/api\/v2_1\/orders\/([^/?]+)/);
  if (m) { const o = remote[decodeURIComponent(m[1])]; return o ? new Response(JSON.stringify({ orders: [o] }), { status: 200 }) : new Response("{}", { status: 404 }); }
  throw new Error("nieoczekiwany fetch " + u);
};
const order = async (id, pid, totalZl, extra = {}) => {
  await O.insertCreatingOrder(null, { id, buyerName: "T", buyerEmail: "t@test.invalid", note: "", items: [{ product_id: "33333333-3333-3333-3333-333333333333", quantity: 1, unitPrice: String(Math.round(totalZl * 100)) }], total: totalZl, ...extra });
  if (pid) await O.attachPayuOrder(null, id, pid, "https://payu.test/r");
};
const note = (pid, ext, status, amount, over = {}) => ({ orderId: pid, extOrderId: ext, status, totalAmount: String(amount), currencyCode: "PLN", merchantPosId: PAYU.posId, ...over });
const row = (id) => one(`SELECT status, payu_status, fulfilled_at IS NOT NULL AS f, fulfill_tries, fulfill_error, fulfill_review, is_test FROM public.orders WHERE id='${id}'`);
const ev = (id) => one(`SELECT processed_at IS NOT NULL AS done, tries, result, last_error, next_attempt_at > now() AS later FROM public.payu_events WHERE id='${id}'`);

await t("klient nie oznaczy zamówienia jako testowego (is_test z danych zamówienia ignorowane)", async () => {
  await order("o-isTest-0000", "P-ISTEST", 2, { is_test: true, isTest: true });
  eq((await row("o-isTest-0000")).is_test, false);
});
await t("CREATING → PENDING po utworzeniu w PayU", async () => { await order("o1", "P1", 2); eq((await row("o1")).status, "PENDING"); });
await t("COMPLETED zgodne → opłacone, zrealizowane raz, zdarzenie zamknięte", async () => {
  const r = await Q.handleNotification(null, PAYU, note("P1", "o1", "COMPLETED", 200));
  eq([r.status, r.fulfilled], ["COMPLETED", true]);
  const x = await row("o1"); eq([x.status, x.payu_status, x.f], ["COMPLETED", "COMPLETED", true]);
  eq(calls.filter((c) => c === "P1").length, 1); eq((await ev("P1:COMPLETED")).result, "opłacone");
});
await t("duplikat powiadomienia → bez drugiej realizacji", async () => {
  const r = await Q.handleNotification(null, PAYU, note("P1", "o1", "COMPLETED", 200));
  eq(r.duplicate, true); eq(calls.filter((c) => c === "P1").length, 1);
});
await t("spóźnione PENDING po COMPLETED nie cofa statusu", async () => {
  await Q.handleNotification(null, PAYU, note("P1", "o1", "PENDING", 200)); eq((await row("o1")).status, "COMPLETED");
});
await t("niezgodna kwota → MISMATCH, bez realizacji, alert do admina", async () => {
  await order("o2", "P2", 2); const before = mails.length;
  const r = await Q.handleNotification(null, PAYU, note("P2", "o2", "COMPLETED", 100));
  eq(r.mismatch, true); const x = await row("o2"); eq([x.status, x.payu_status, x.f], ["PENDING", "MISMATCH", false]);
  eq(calls.includes("P2"), false); eq(mails.length, before + 1); eq(mails.at(-1).kind, "platnosc_niezgodna");
});
await t("inny POS i inna waluta → MISMATCH", async () => {
  await order("o3", "P3", 2); await order("o4", "P4", 2);
  eq((await Q.handleNotification(null, PAYU, note("P3", "o3", "COMPLETED", 200, { merchantPosId: "999" }))).mismatch, true);
  eq((await Q.handleNotification(null, PAYU, note("P4", "o4", "COMPLETED", 200, { currencyCode: "EUR" }))).mismatch, true);
});
await t("powiadomienie przed zapisem zamówienia → w kolejce, potem przetworzone przez drain", async () => {
  const r = await Q.handleNotification(null, PAYU, note("P5", "o5", "COMPLETED", 200));
  eq(r.queued, true); const e1 = await ev("P5:COMPLETED"); eq([e1.done, e1.later, e1.last_error], [false, true, "brak zamówienia"]);
  await order("o5", null, 2);                                      // zamówienie bez numeru PayU (CREATING) — dopasowanie po extOrderId
  await db.exec(`UPDATE public.payu_events SET next_attempt_at = now() - interval '1 second' WHERE id='P5:COMPLETED'`);
  eq(await Q.drainPayuEvents(null, 5), 1);
  const x = await row("o5"); eq([x.status, x.f], ["COMPLETED", true]); eq((await ev("P5:COMPLETED")).done, true);
});
await t("zdarzenie nie znika po wielu próbach (np. 12 nieudanych)", async () => {
  await Q.handleNotification(null, PAYU, note("P6", "o6", "COMPLETED", 200));
  for (let i = 0; i < 12; i++) { await db.exec(`UPDATE public.payu_events SET next_attempt_at = now() - interval '1 second' WHERE id='P6:COMPLETED'`); await Q.drainPayuEvents(null, 5); }
  const e = await ev("P6:COMPLETED"); eq([e.done, e.tries >= 12], [false, true]);
});
await t("błąd bazy w trakcie → zdarzenie wraca do kolejki z odstępem", async () => {
  await order("o7", "P7", 2);
  globalThis.__failSql = (q) => /SET status = 'COMPLETED', payu_status = 'COMPLETED'/.test(q);
  let thrown = false; try { await Q.handleNotification(null, PAYU, note("P7", "o7", "COMPLETED", 200)); } catch { thrown = true; }
  globalThis.__failSql = null;
  const e = await ev("P7:COMPLETED"); eq([thrown, e.done, e.later], [true, false, true]);
  await db.exec(`UPDATE public.payu_events SET next_attempt_at = now() - interval '1 second' WHERE id='P7:COMPLETED'`);
  await Q.drainPayuEvents(null, 5); eq((await row("o7")).f, true);
});
await t("realizacja nieudana → płatność zostaje, fulfilled_at puste; ponowienie realizuje (idempotentnie)", async () => {
  await order("o8", "P8", 2); globalThis.__failFulfill = (p) => p === "P8";
  const r = await Q.handleNotification(null, PAYU, note("P8", "o8", "COMPLETED", 200));
  eq([r.status, r.fulfilled], ["COMPLETED", false]); let x = await row("o8"); eq([x.status, x.f, !!x.fulfill_error, x.fulfill_tries], ["COMPLETED", false, true, 1]);
  globalThis.__failFulfill = null;
  await db.exec(`UPDATE public.orders SET updated_date = now() - interval '1 hour' WHERE id='o8'`);
  eq(await Q.retryUnfulfilled(null, 5), 1); x = await row("o8"); eq([x.f, x.fulfill_error], [true, null]);
  eq(await Q.retryUnfulfilled(null, 5), 0, "drugie ponowienie");
});
await t("równoległa realizacja: tylko jedna przejmuje zamówienie", async () => {
  await order("o9", "P9", 2); await Q.markPaid(null, "P9");
  const [a, b] = await Promise.all([Q.fulfillPaid(null, "P9"), Q.fulfillPaid(null, "P9")]);
  eq([a.fulfilled, b.fulfilled].sort(), [false, true]); eq(calls.filter((c) => c === "P9").length, 1);
});
await t("migracyjne „DO RĘCZNEJ WERYFIKACJI” nie są ponawiane automatycznie", async () => {
  const before = calls.length; await Q.retryUnfulfilled(null, 10); eq(calls.length, before); eq((await row("cccccccc-0000-0000-0000-000000000003")).f, false);
});
await t("alerty: nieudana realizacja (≥3 próby) i zaległe zdarzenie — jednorazowo", async () => {
  await order("o10", "P10", 2); await Q.markPaid(null, "P10");
  await db.exec(`UPDATE public.orders SET fulfill_tries = 3, fulfill_error = 'x' WHERE id='o10'`);
  const before = mails.length; const n1 = await Q.alertStale(null);
  const kinds = mails.slice(before).map((m) => m.subject);
  eq(n1, 2); eq(kinds.some((s) => /bez realizacji/.test(s)) && kinds.some((s) => /zaległe powiadomienie/.test(s)), true);
  eq(await Q.alertStale(null), 0, "drugi przebieg");
});
await t("wznowienie: PayU nie potwierdza (PENDING) → odmowa, brak zmian", async () => {
  await order("o11", "P11", 2); await Q.markPaid(null, "P11"); globalThis.__failFulfill = (p) => p === "P11";
  await Q.fulfillPaid(null, "P11").catch(() => {}); globalThis.__failFulfill = null;
  remote["P11"] = note("P11", "o11", "PENDING", 200);
  let msg = ""; try { await Q.resumeFulfillment(null, "o11"); } catch (e) { msg = e.message; }
  eq(/nie potwierdza/.test(msg), true, msg); eq((await row("o11")).f, false);
});
await t("wznowienie: PayU COMPLETED zgodne → zrealizowane", async () => {
  remote["P11"] = note("P11", "o11", "COMPLETED", 200);
  const r = await Q.resumeFulfillment(null, "o11"); eq([r.ok, r.fulfilled], [true, true]); eq(/wznowione ręcznie/.test((await row("o11")).fulfill_review), true);
});
await t("wznowienie sporne (MISMATCH): bez potwierdzenia → needsConfirm, z potwierdzeniem → zrealizowane", async () => {
  remote["P2"] = note("P2", "o2", "COMPLETED", 200);
  const r1 = await Q.resumeFulfillment(null, "o2"); eq(r1.needsConfirm, true); eq((await row("o2")).payu_status, "MISMATCH");
  const r2 = await Q.resumeFulfillment(null, "o2", { confirm: true }); eq(r2.fulfilled, true);
  const x = await row("o2"); eq([x.status, x.payu_status, x.f], ["COMPLETED", "COMPLETED", true]);
});
await t("wznowienie: kwota w PayU inna niż zamówienie → odmowa nawet z potwierdzeniem", async () => {
  remote["P3"] = note("P3", "o3", "COMPLETED", 999);
  let msg = ""; try { await Q.resumeFulfillment(null, "o3", { confirm: true }); } catch (e) { msg = e.message; }
  eq(/nie zgadza się/.test(msg), true, msg); eq((await row("o3")).f, false);
});
await t("wznowienie zamówienia bez numeru PayU → odmowa", async () => {
  await order("o12", null, 2); let msg = ""; try { await Q.resumeFulfillment(null, "o12", { confirm: true }); } catch (e) { msg = e.message; } eq(/nie ma numeru PayU/.test(msg), true, msg);
});
await t("zamówienie testowe (is_test tylko backendem): pełna ścieżka, realizacja bez skutków", async () => {
  await order("o13", "P13", 2); await db.exec(`UPDATE public.orders SET is_test = true WHERE id='o13'`);
  const before = calls.length; const r = await Q.handleNotification(null, PAYU, note("P13", "o13", "COMPLETED", 200));
  eq(r.fulfilled, true); eq(calls.length, before, "brak wywołań realizacji produkcyjnej"); eq(/^TEST/.test((await row("o13")).fulfill_review), true);
});
await t("brak DDL w trakcie obsługi płatności (log zapytań)", async () => {
  const ddl = sqlLog.filter((q) => /\b(CREATE|ALTER|DROP)\s+(TABLE|INDEX|FUNCTION|SCHEMA)/i.test(q));
  eq(ddl.length, 0, ddl.slice(0, 2).join(" | "));
});

console.log("3) PRAWDZIWA fulfillOrder dla is_test — wczesny powrót bez zapytań");
const F = await import("./out/f.mjs");
await t("fulfillOrder(is_test) nie wykonuje żadnego zapytania ani maila", async () => {
  const s = sqlLog.length, m = mails.length;
  const r = await F.fulfillOrder(null, { id: "x", is_test: true, items: [{ product_id: "11111111-1111-1111-1111-111111111111" }], buyer_email: "t@test.invalid" }, "PX");
  eq(r, { test: true }); eq([sqlLog.length - s, mails.length - m], [0, 0]);
});

console.log("4) LIMITY MIEJSC — CREATING zajmuje miejsce");
const S = await import("./out/seats.mjs");
await t("productSeats liczy zamówienie CREATING jako zajęte", async () => {
  await O.insertCreatingOrder(null, { id: "o-seat", buyerName: "T", buyerEmail: "t@test.invalid", note: "", items: [{ product_id: "44444444-4444-4444-4444-444444444444", quantity: 1 }], total: 50 });
  const m = await S.productSeats(null, ["44444444-4444-4444-4444-444444444444"]);
  const v = m.get("44444444-4444-4444-4444-444444444444"); eq(v && v.left, 0, JSON.stringify(v));
});

console.log(`\nWYNIK: ${ok} OK, ${bad} BŁĄD`);
process.exit(bad ? 1 : 0);
