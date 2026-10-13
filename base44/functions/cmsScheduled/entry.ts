import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { recordPrices, warsawToday } from "../../shared/productPrice.ts";
import { runSql, escStr } from "../../shared/supabase.ts";
import { ensureWaitlistCols, notifyBatch } from "../../shared/waitlist.ts";
import { requireMail } from "../../shared/smtp.ts";
import { clearSnap } from "../../shared/snapshot.ts";
import { unpaidReminders } from "../../shared/unpaidReminder.ts";

// Higiena listy oczekujących (raz na dobę na instancję): 90 dni po powiadomieniu, a bez powiadomienia po 12 miesiącach.
let lastHygiene = "";
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
    // Przy okazji (najwyżej raz na godzinę): dzisiejsze ceny produktów do historii — podstawa informacji Omnibus.
    const prices = await recordPrices(base44).catch(() => -1);
    await waitlistHygiene(base44).catch(() => {});
    const released = await releaseDue(base44).catch((e) => { console.error("premiera:", e.message); return []; });
    const ready = await requireMail(base44).then(() => true).catch(() => false);
    const reminded = ready ? await unpaidReminders(base44).catch((e) => { console.error("przypomnienia:", e.message); return 0; }) : 0;
    return Response.json({ ok: true, published: done, prices, released, reminded });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}