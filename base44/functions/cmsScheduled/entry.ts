import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { recordPrices, warsawToday } from "../../shared/productPrice.ts";
import { runSql, escStr } from "../../shared/supabase.ts";
import { ensureWaitlistCols, notifyBatch } from "../../shared/waitlist.ts";
import { requireMail } from "../../shared/smtp.ts";
import { clearSnap } from "../../shared/snapshot.ts";
import { unpaidReminders } from "../../shared/unpaidReminder.ts";
import { safeEqual } from "../../shared/libraryAccess.ts";
import { applyDataPatches } from "../../shared/dataPatches.ts";
import { getOrderByPayuId, claimCompletion } from "../../shared/orders.ts";
import { fulfillOrder } from "../../shared/fulfillOrder.ts";
import { loadAppUrl } from "../../shared/settings.ts";

// Zamówienia za 0 zł (całość pokryta kartą/kodem) nie mają powiadomienia PayU, które by je ponowiło.
// Gdy realizacja w kasie się nie udała, zamówienie zostaje PENDING — tu dokańczamy je (najwyżej 5 na przebieg, do doby wstecz).
async function retryFreeOrders(base44) {
  const rows = await runSql(base44, `SELECT payu_order_id FROM public.orders WHERE status = 'PENDING' AND payu_order_id LIKE 'FREE-%'
    AND created_date < now() - interval '3 minutes' AND created_date > now() - interval '1 day' ORDER BY created_date LIMIT 5`, true);
  let done = 0;
  for (const r of rows) {
    const order = await getOrderByPayuId(base44, r.payu_order_id);
    if (order && await claimCompletion(base44, r.payu_order_id)) {
      await fulfillOrder(base44, order, r.payu_order_id).then(() => done++).catch((e) => console.error("zamówienie 0 zł:", e?.message));
    }
  }
  return done;
}

// Higiena listy oczekujących (raz na dobę na instancję): 90 dni po powiadomieniu, a bez powiadomienia po 12 miesiącach.
let lastHygiene = "";
// Kopie publicznych danych (PublicSnapshot): katalog ma klucz z datą, więc codziennie przybywa wiersz,
// a równoległe pierwsze odczyty potrafią założyć duplikaty. Raz na dobę: zostaje najnowszy wiersz każdego
// klucza, a kopie katalogu starsze niż 3 dni znikają. Najwyżej 100 usunięć na przebieg.
async function pruneSnapshots(base44) {
  const lock = await runSql(base44, `INSERT INTO public.app_settings (key, value, updated_date)
      VALUES ('snap_prune', jsonb_build_object('at', now()), now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_date = now()
      WHERE public.app_settings.updated_date < now() - interval '1 day'
    RETURNING key`).catch(() => []);
  if (!lock?.length) return 0;
  const ent = base44.asServiceRole.entities.PublicSnapshot;
  const rows = await ent.list("-refreshed_at", 1000).catch(() => []);
  const cutoff = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
  const seen = new Set();
  const del = [];
  for (const r of rows || []) {
    const k = String(r.key || "");
    const oldDay = /^products:\d{4}-\d{2}-\d{2}$/.test(k) && k.slice(9) < cutoff;
    if (oldDay || seen.has(k)) del.push(r.id); else seen.add(k);
  }
  let n = 0;
  for (const id of del.slice(0, 100)) { await ent.delete(id).then(() => n++).catch(() => {}); }
  return n;
}

async function waitlistHygiene(base44) {
  const day = new Date().toISOString().slice(0, 10);
  if (lastHygiene === day) return;
  lastHygiene = day;
  await runSql(base44, `ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS notified_at timestamptz`);
  await runSql(base44, `DELETE FROM public.waitlist WHERE (notified_at IS NOT NULL AND notified_at < now() - interval '90 days')
    OR (notified_at IS NULL AND created_at < now() - interval '12 months')`);
  // Kopie katalogu Skarbca z poprzednich dni (klucz products:RRRR-MM-DD) — to tylko pamięć podręczna.
  const snaps = base44.asServiceRole.entities.PublicSnapshot;
  const old = await snaps.filter({ key: { $regex: "^products:" } }, "-refreshed_at", 200).catch(() => []);
  const keep = `products:${warsawToday()}`;
  await Promise.all(old.filter((r) => r.key !== keep).map((r) => snaps.delete(r.id).catch(() => {})));
}

// Premiera o czasie: „wkrótce” → „dostępny” po terminie, potem lista oczekujących partiami (gdy działa poczta).
async function releaseDue(base44) {
  await ensureWaitlistCols(base44);
  const due = await runSql(base44, `UPDATE public.products SET status = 'dostępny', available_at = COALESCE(available_at, now()),
      release_at = NULL, release_notify = TRUE
    WHERE status = 'wkrótce' AND active = TRUE AND release_at IS NOT NULL AND release_at <= now() RETURNING slug`);
  if (due.length) await clearSnap(base44, "products:").catch(() => {});
  const ready = await requireMail(base44).then(() => true).catch(() => false);
  if (!ready) return due.map((r) => r.slug);
  const pend = await runSql(base44, `SELECT id, release_note FROM public.products WHERE release_notify = TRUE LIMIT 5`, true);
  for (const p of pend) {
    const r = await notifyBatch(base44, p.id, String(p.release_note || ""), 40).catch(() => ({ left: 0 }));
    if (!r.left) await runSql(base44, `UPDATE public.products SET release_notify = FALSE WHERE id = ${escStr(p.id)}`);
  }
  return due.map((r) => r.slug);
}

// Publikuje strony zaplanowane na termin, który już minął (wywoływane cyklicznie).
// Działa tylko na tym, co admin zaplanował — bezpieczne do wywołania bez logowania.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    // Dostęp: administrator albo zadanie cykliczne z tokenem (mb_settings.tick_token).
    const body = await req.json().catch(() => ({}));
    const me = await base44.auth.me().catch(() => null);
    let allowed = me?.role === "admin";
    if (!allowed) {
      const rows = await runSql(base44, `SELECT tick_token FROM public.mb_settings WHERE id = 1`, true).catch(() => null);
      const stored = rows?.[0]?.tick_token;
      const given = typeof body.tick_token === "string" ? body.tick_token : "";
      allowed = !!stored && !!given && safeEqual(given, stored);
    }
    if (!allowed) return Response.json({ error: "Forbidden" }, { status: 403 });
    const db = base44.asServiceRole.entities;
    const now = new Date().toISOString();
    const due = await db.SitePage.filter({ status: "zaplanowana", publikacja: { $lte: now } }, { limit: 20 });
    const done = [];
    for (const page of due.items) {
      const bloki = page.plan_bloki || page.bloki || [];
      const wersja = (page.wersja || 0) + 1;
      const kto = page.plan_kto || "";
      const opis = `publikacja zaplanowana · ${bloki.length} bloków`;
      await db.PublishedPage.upsert([{ slug: page.slug, tytul: page.tytul, seo_title: page.seo_title || "", seo_description: page.seo_description || "",
        seo_image: page.seo_image || "", noindex: !!page.noindex, bloki, wersja }], { key: "slug" });
      await db.SitePage.update(page.id, { status: "opublikowana", wersja, opublikowano_at: now, plan_bloki: [], publikacja: null });
      await db.PageVersion.create({ slug: page.slug, wersja, tytul: page.tytul, bloki, kto, opis });
      await db.ContentLog.create({ page_slug: page.slug, akcja: "publikacja", wersja, kto, opis });
      done.push(page.slug);
    }
    // Jednorazowe poprawki danych zapisane w kodzie (base44/shared/dataPatches.ts).
    const patched = await applyDataPatches(base44).catch((e) => { console.error("poprawki danych:", e.message); return []; });
    // Przy okazji (najwyżej raz na godzinę): dzisiejsze ceny produktów do historii — podstawa informacji Omnibus.
    const prices = await recordPrices(base44, patched.length > 0).catch(() => -1);
    await waitlistHygiene(base44).catch(() => {});
    const released = await releaseDue(base44).catch((e) => { console.error("premiera:", e.message); return []; });
    await loadAppUrl(base44).catch(() => {});
    const freeDone = await retryFreeOrders(base44).catch((e) => { console.error("zamówienia 0 zł:", e.message); return 0; });
    const pruned = await pruneSnapshots(base44).catch((e) => { console.error("kopie:", e.message); return 0; });
    const ready = await requireMail(base44).then(() => true).catch(() => false);
    const reminded = ready ? await unpaidReminders(base44).catch((e) => { console.error("przypomnienia:", e.message); return 0; }) : 0;
    return Response.json({ ok: true, published: done, prices, released, reminded, patched, freeDone, pruned });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}