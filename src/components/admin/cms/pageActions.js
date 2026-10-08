import { base44 } from "@/api/base44Client";

export const slugify = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

const freshIds = (bloki = []) => bloki.map((b) => ({ ...structuredClone(b), id: crypto.randomUUID() }));

// Kopia strony jako nowy szkic.
export async function duplicatePage(p, taken) {
  const name = window.prompt("Nazwa kopii strony:", `${p.tytul} (kopia)`);
  if (!name?.trim()) return null;
  const slug = slugify(name);
  if (!slug || taken.includes(slug)) { window.alert("Strona o takim adresie już istnieje."); return null; }
  return base44.entities.SitePage.create({ tytul: name.trim(), slug, status: "szkic", bloki: freshIds(p.bloki), wersja: 0,
    seo_title: p.seo_title, seo_description: p.seo_description, seo_image: p.seo_image, noindex: p.noindex });
}

// Zmiana adresu /strona/stary → /strona/nowy z przekierowaniem ze starego adresu.
export async function renamePage(p, taken) {
  const next = slugify(window.prompt("Nowy adres strony (po /strona/):", p.slug) || "");
  if (!next || next === p.slug) return false;
  if (taken.includes(next)) { window.alert("Strona o takim adresie już istnieje."); return false; }
  await base44.entities.SitePage.update(p.id, { slug: next });
  const pub = await base44.entities.PublishedPage.filter({ slug: p.slug }, { limit: 1 });
  if (pub.items[0]) await base44.entities.PublishedPage.update(pub.items[0].id, { slug: next });
  await base44.entities.PageRedirect.deleteMany({ from_slug: next });
  await base44.entities.PageRedirect.updateMany({ to_slug: p.slug }, { $set: { to_slug: next } });
  await base44.entities.PageRedirect.create({ from_slug: p.slug, to_slug: next });
  await base44.entities.ContentLog.create({ page_slug: next, akcja: "zmiana adresu", opis: `/strona/${p.slug} → /strona/${next}` });
  return true;
}