import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, escStr } from "../../shared/supabase.ts";

const CATEGORIES = ["ebook", "warsztat", "mentoring", "mastermind", "retreat", "darmowe"];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const slug = typeof body.slug === "string" ? body.slug : null;
    const category =
      typeof body.category === "string" && CATEGORIES.includes(body.category)
        ? body.category
        : null;

    let where = "active = TRUE";
    if (slug && /^[a-z0-9-]+$/.test(slug)) where += ` AND slug = ${escStr(slug)}`;
    if (category) where += ` AND category = ${escStr(category)}`;

    const products = await runSql(
      base44,
      `SELECT id, name, slug, subtitle, description, long_description, price::float8 AS price, old_price::float8 AS old_price,
              category, image_url, gallery, featured, active, details, format, duration, spots,
              created_date, updated_date
       FROM public.products
       WHERE ${where}
       ORDER BY price ASC
       LIMIT 200`,
      true
    );

    return Response.json({ products });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}