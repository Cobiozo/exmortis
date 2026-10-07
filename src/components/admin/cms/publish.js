import { base44 } from "@/api/base44Client";

// Publikacja: kopiuje szkic do wersji publicznej, podbija numer wersji i zapisuje wpis w dzienniku.
export async function publishPage(page, blocks) {
  const wersja = (page.wersja || 0) + 1;
  const pub = { slug: page.slug, tytul: page.tytul, seo_title: page.seo_title || "", seo_description: page.seo_description || "",
    seo_image: page.seo_image || "", noindex: !!page.noindex, bloki: blocks, wersja };
  await base44.entities.PublishedPage.upsert([pub], { key: "slug" });
  const now = new Date().toISOString();
  await base44.entities.SitePage.update(page.id, { bloki: blocks, status: "opublikowana", wersja, opublikowano_at: now, zmiany_niezapisane: false });
  const me = await base44.auth.me().catch(() => null);
  await base44.entities.ContentLog.create({ page_slug: page.slug, akcja: "publikacja", wersja, kto: me?.email || "", opis: `${blocks.length} bloków` });
  return { wersja, opublikowano_at: now };
}