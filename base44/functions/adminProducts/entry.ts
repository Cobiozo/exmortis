import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, escStr, requireAdmin } from "../../shared/supabase.ts";

const CATEGORIES = ["ebook", "warsztat", "mentoring", "mastermind", "retreat", "darmowe"];

// Tekst opcjonalny → NULL; obcięty do max.
function textVal(v, max) {
  if (v === undefined || v === null || String(v).trim() === "") return "NULL";
  return escStr(String(v).slice(0, max));
}

// Tablica stringów → jsonb; [] → puste jsonb; brak → NULL.
function arrVal(v) {
  if (!Array.isArray(v)) return "NULL";
  const items = v.filter((x) => typeof x === "string").slice(0, 50);
  return items.length ? `${escStr(JSON.stringify(items))}::jsonb` : "'[]'::jsonb";
}

function buildValues(p, name, slug, price, oldPrice, category) {
  return {
    name: textVal(name, 200),
    slug: escStr(slug),
    subtitle: textVal(p.subtitle, 300),
    description: textVal(p.description, 3000),
    long_description: textVal(p.long_description, 60000),
    price,
    old_price: oldPrice === null ? "NULL" : oldPrice,
    category: escStr(category),
    image_url: textVal(p.image_url, 1000),
    gallery: arrVal(p.gallery),
    featured: p.featured ? "TRUE" : "FALSE",
    active: p.active === false ? "FALSE" : "TRUE",
    details: arrVal(p.details),
    format: textVal(p.format, 200),
    duration: textVal(p.duration, 200),
    spots: textVal(p.spots, 200),
  };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await requireAdmin(base44);
    const body = await req.json().catch(() => ({}));

    if (body.action === "list") {
      const products = await runSql(
        base44,
        `SELECT id, name, slug, subtitle, description, long_description, price::float8 AS price, old_price::float8 AS old_price,
                category, image_url, gallery, featured, active, details, format, duration, spots, created_date, updated_date
         FROM public.products
         ORDER BY created_date DESC
         LIMIT 500`,
        true
      );
      return Response.json({ products });
    }

    if (body.action === "save") {
      const p = body.product || {};
      const name = String(p.name || "").trim().slice(0, 200);
      if (!name) throw new Error("Produkt musi mieć nazwę");

      let slug = String(p.slug || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
      if (!slug) slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
      if (!slug) slug = `produkt-${Date.now()}`;

      const price = Number(p.price);
      if (!Number.isFinite(price) || price < 0) throw new Error("Niepoprawna cena");
      const oldPrice = p.old_price === "" || p.old_price === null || p.old_price === undefined ? null : Number(p.old_price);
      if (oldPrice !== null && (!Number.isFinite(oldPrice) || oldPrice < 0)) throw new Error("Niepoprawna cena przekreślona");
      const category = CATEGORIES.includes(p.category) ? p.category : "ebook";

      const v = buildValues(p, name, slug, price, oldPrice, category);

      if (p.id) {
        await runSql(
          base44,
          `UPDATE public.products SET
             name = ${v.name}, slug = ${v.slug}, subtitle = ${v.subtitle}, description = ${v.description},
             long_description = ${v.long_description}, price = ${v.price}, old_price = ${v.old_price},
             category = ${v.category}, image_url = ${v.image_url}, gallery = ${v.gallery},
             featured = ${v.featured}, active = ${v.active}, details = ${v.details},
             format = ${v.format}, duration = ${v.duration}, spots = ${v.spots}, updated_date = now()
           WHERE id = ${escStr(String(p.id))}`
        );
      } else {
        await runSql(
          base44,
          `INSERT INTO public.products
             (name, slug, subtitle, description, long_description, price, old_price, category, image_url,
              gallery, featured, active, details, format, duration, spots, created_by_id)
           VALUES (${v.name}, ${v.slug}, ${v.subtitle}, ${v.description}, ${v.long_description}, ${v.price}, ${v.old_price},
                   ${v.category}, ${v.image_url}, ${v.gallery}, ${v.featured}, ${v.active}, ${v.details},
                   ${v.format}, ${v.duration}, ${v.spots}, ${escStr(user.id)})`
        );
      }
      return Response.json({ ok: true });
    }

    if (body.action === "delete") {
      const id = String(body.id || "");
      if (!id) throw new Error("Brak id produktu");
      await runSql(base44, `DELETE FROM public.products WHERE id = ${escStr(id)}`);
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (error) {
    if (error && error.message === "FORBIDDEN") {
      return Response.json({ error: "Brak dostępu" }, { status: 403 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
}