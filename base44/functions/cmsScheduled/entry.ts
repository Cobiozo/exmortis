import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { recordPrices } from "../../shared/productPrice.ts";
import { runSql } from "../../shared/supabase.ts";

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
  const keep = `products:${new Date(Date.now() + 864e5 * 0).toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" })}`;
  await Promise.all(old.filter((r) => r.key !== keep).map((r) => snaps.delete(r.id).catch(() => {})));
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
    return Response.json({ ok: true, published: done, prices });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}