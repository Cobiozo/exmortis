import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { recordPrices } from "../../shared/productPrice.ts";

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
    return Response.json({ ok: true, published: done, prices });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}