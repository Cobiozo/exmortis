import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, escStr } from "../../shared/supabase.ts";
import { withSteps, unitPrice, omnibusPrices, omnibusFrom, warsawToday } from "../../shared/productPrice.ts";
import { getSnap } from "../../shared/snapshot.ts";
import { ratingMap } from "../../shared/reviews.ts";
import { productSeats } from "../../shared/seats.ts";

// Katalog z kopii (PublicSnapshot, odświeżanej w tle co minutę) — bez czekania na Supabase przy każdym wejściu.
// Klucz zawiera dzisiejszą datę (czas polski), więc po północy ceny z drabinki nigdy nie są wczorajsze.
// Zapis produktu w panelu oznacza kopie jako stare (clearSnap "products:").
// Strona produktu korzysta z tej samej kopii (filtr po adresie) — jedna kopia na dzień, bez wpisów dla dowolnych adresów.
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
            product_type, access_months, to_jsonb(p)->>'capacity' AS capacity,
            to_jsonb(p)->'price_steps' AS price_steps, to_jsonb(p)->'price_options' AS price_options,
            to_jsonb(p)->'bundle_items' AS bundle_items,
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
  // Średnia ocen i liczba opinii liczone w kopii katalogu (odświeżanej w tle) — nie przy wejściu gościa.
  const ratings = await ratingMap(base44, out.map((p) => String(p.id))).catch(() => new Map());
  for (const p of out) {
    const r = ratings.get(String(p.id));
    if (r) { p.rating_avg = r.avg; p.rating_count = r.count; }
  }
  // Miejsca (limit, sprzedane, w trakcie płatności) liczone w kopii katalogu — świeżość do minuty.
  // Kasa i tak sprawdza limit przy zakupie, więc opóźnienie kopii niczego nie przepuszcza.
  const seats = await productSeats(base44, out.filter((p) => p.capacity != null).map((p) => String(p.id))).catch(() => new Map());
  for (const p of out) {
    const s = seats.get(String(p.id));
    if (s) p.seats = s;
  }
  // Pakiety: składniki (nazwa, typ, adres, cena) i odwrotne „taniej w pakiecie” — liczone w kopii katalogu.
  const catalogIds = new Set(out.map((p) => String(p.id)));
  const pkgs = out.filter((p) => p.product_type === "pakiet" && Array.isArray(p.bundle_items) && p.bundle_items.length);
  const compIds = [...new Set(pkgs.flatMap((p) => p.bundle_items.map(String)))];
  const comps = compIds.length
    ? await runSql(base44, `SELECT id::text AS id, name, slug, product_type,
        price::float8 AS price, price_regular::float8 AS price_regular, price_start::float8 AS price_start,
        promo_end_date::text AS promo_end_date, to_jsonb(p)->'price_steps' AS price_steps
       FROM public.products WHERE id::text IN (${compIds.map(escStr).join(",")})`, true).catch(() => [])
    : [];
  const compById = new Map((comps || []).map((c) => [String(c.id), withSteps(c)]));
  const inPkg = new Map();
  for (const p of pkgs) {
    const items = p.bundle_items.map(String).map((id) => compById.get(id)).filter(Boolean).map((c) => ({
      id: String(c.id), name: c.name, slug: c.slug, product_type: c.product_type,
      price: unitPrice(c), available: catalogIds.has(String(c.id)),
    }));
    if (!items.length) continue;
    const separately = Math.round(items.reduce((s, c) => s + (Number(c.price) || 0), 0) * 100) / 100;
    const now = unitPrice(p);
    p.bundle = { items, separately, save: Math.round((separately - now) * 100) / 100 };
    if (p.status === "wkrótce") continue; // pakiet jeszcze niedostępny — nie proponujemy go pod składnikiem
    for (const c of items) {
      const l = inPkg.get(c.id) || [];
      l.push({ slug: p.slug, name: p.name, price: now });
      inPkg.set(c.id, l);
    }
  }
  for (const p of out) { delete p.bundle_items; const ip = inPkg.get(String(p.id)); if (ip) p.in_packages = ip; }
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
    let out;
    try {
      out = await getSnap(base44, `products:${today}`, () => loadCatalog(base44, "", today));
      if (slug) out = (out || []).filter((p) => p.slug === slug);
    } catch {
      out = await loadCatalog(base44, slug, today); // pierwsze wejście dnia przy wolnym Supabase — wolniej, ale zawsze z odpowiedzią
    }
    // Na stronie produktu: które składniki pakietu osoba już ma (kopia katalogu jest wspólna, więc liczone osobno).
    if (slug && out?.length) {
      const me = await base44.auth.me().catch(() => null);
      const mail = me?.email ? String(me.email).toLowerCase() : "";
      if (mail) {
        const access = await base44.asServiceRole.entities.Access.filter({ user_email: mail }, "-created_date", 300).catch(() => []);
        const owned = new Set(access.filter((a) => !a.revoked).map((a) => String(a.product_id)));
        out = out.map((p) => p.bundle
          ? { ...p, bundle: { ...p.bundle, items: p.bundle.items.map((c) => ({ ...c, owned: owned.has(String(c.id)) })) } }
          : p);
      }
    }
    return Response.json({ products: out || [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}