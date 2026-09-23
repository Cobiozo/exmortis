import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, escStr } from "../../shared/supabase.ts";

// Publiczny katalog Skarbca: produkty dostępne i "wkrótce", posortowane po poziomie drabiny.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    let where = "active = TRUE AND COALESCE(status, 'dostępny') <> 'ukryty'";
    const slug = typeof body.slug === "string" ? body.slug.trim() : "";
    if (slug && /^[a-z0-9-]+$/.test(slug)) where += ` AND slug = ${escStr(slug)}`;

    const products = await runSql(
      base44,
      `SELECT id, name, slug, subtitle, description, long_description,
              price::float8 AS price, old_price::float8 AS old_price, category, image_url, gallery,
              featured, active, details, format, duration, spots,
              level, stage, form, audience_tags, promise, for_whom, format_details,
              price_start::float8 AS price_start, price_regular::float8 AS price_regular,
              is_free, status, promo_end_date::text AS promo_end_date,
              button_label, checkout_url, next_step, is_featured, sort_order, cover_image,
              created_date, updated_date
       FROM public.products
       WHERE ${where}
       ORDER BY level ASC NULLS LAST, sort_order ASC NULLS LAST, created_date ASC
       LIMIT 200`,
      true
    );

    return Response.json({ products });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}