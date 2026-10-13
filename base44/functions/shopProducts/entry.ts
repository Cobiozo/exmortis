import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, escStr } from "../../shared/supabase.ts";
import { withSteps, unitPrice, omnibusPrices, omnibusFrom, warsawToday } from "../../shared/productPrice.ts";
import { getSnap } from "../../shared/snapshot.ts";

// Katalog z kopii (PublicSnapshot, odświeżanej w tle co minutę) — bez czekania na Supabase przy każdym wejściu.
// Klucz zawiera dzisiejszą datę (czas polski), więc po północy ceny z drabinki nigdy nie są wczorajsze.
// Zapis produktu w panelu oznacza kopie jako stare (clearSnap "products:").
async function loadCatalog(base44, slug: string, today: string) {
  let where = "active = TRUE AND COALESCE(status, 'dostępny') <> 'ukryty'";
  if (slug) where += ` AND slug = ${escStr(slug)}`;
  const products = await runSql(
    base44,
    `SELECT id, name, slug, subtitle, description, long_description,
            price::float8 AS price, old_price::float8 AS old_price, category, image_url, gallery,
            featured, active, details, format, duration, spots,
            level, stage, form, audience_tags, promise, for_whom, format_details,
            price_start::float8 AS price_start, price_regular::float8 AS price_regular,
            is_free, status, promo_end_date::text AS promo_end_date,
            button_label, checkout_url, next_step, is_featured, sort_order, cover_image,
            product_type, access_months, to_jsonb(p)->'price_steps' AS price_steps,
            created_date, updated_date
     FROM public.products p
     WHERE ${where}
     ORDER BY level ASC NULLS LAST, sort_order ASC NULLS LAST, created_date ASC
     LIMIT 200`,
    true
  );
  // Drabinka cen → bieżący próg jako zwykła promocja (+ next_price: od kiedy i ile). Omnibus z historii cen.
  const out = (products || []).map((p) => withSteps(p));
  const promo = out.filter((p) => p.price_start != null && p.promo_end_date && String(p.promo_end_date).slice(0, 10) >= today);
  const hist = await omnibusPrices(base44, promo.map((p) => String(p.id)));
  for (const p of promo) {
    const low = omnibusFrom(hist.get(String(p.id)) || [], unitPrice(p), today);
    if (low != null) p.omnibus_price = low;
  }
  for (const p of out) delete p.price_steps; // klient dostaje tylko bieżący i następny próg
  return out;
}

// Publiczny katalog Skarbca: produkty dostępne i "wkrótce", posortowane po poziomie drabiny.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Program kursu na stronie produktu: tylko widoczne lekcje (moduł, tytuł, czas) — bez adresów wideo.
    if (body.action === "curriculum") {
      const pid = String(body.product_id || "");
      if (!/^[0-9a-f-]{36}$/i.test(pid)) return Response.json({ lessons: [] });
      const ok = await runSql(base44, `SELECT 1 FROM public.products WHERE id::text = ${escStr(pid)} AND active = TRUE AND product_type IN ('kurs', 'wideo') AND COALESCE(status, 'dostępny') <> 'ukryty'`, true);
      if (!ok.length) return Response.json({ lessons: [] });
      const list = await base44.asServiceRole.entities.CourseLesson.filter({ product_id: pid, published: true }, "order", 300);
      return Response.json({ lessons: list.map((l) => ({ module: l.module || "", title: l.title, duration_min: l.duration_min || null })) });
    }

    const raw = typeof body.slug === "string" ? body.slug.trim() : "";
    const slug = raw && /^[a-z0-9-]{1,120}$/.test(raw) ? raw : "";
    const today = warsawToday();
    const loader = () => loadCatalog(base44, slug, today);
    let out;
    try {
      out = await getSnap(base44, `products:${today}:${slug || "*"}`, loader);
    } catch {
      out = await loader(); // pierwsze wejście dnia przy wolnym Supabase — wolniej, ale zawsze z odpowiedzią
    }
    return Response.json({ products: out || [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}