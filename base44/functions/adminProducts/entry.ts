import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, escStr, requireAdmin } from "../../shared/supabase.ts";
import { recordPrices, readSteps } from "../../shared/productPrice.ts";
import { requireMail } from "../../shared/smtp.ts";
import { ensureWaitlistCols, notifyBatch } from "../../shared/waitlist.ts";
import { clearSnap } from "../../shared/snapshot.ts";

const CATEGORIES = ["ebook", "warsztat", "mentoring", "mastermind", "retreat", "darmowe"];
const STAGES = ["Śmierć", "Próg", "Powrót", "Inny", "Wszystkie"];
const FORMS = ["Czytam", "Słucham", "Oglądam", "Uczestniczę", "Idę głęboko"];
const STATUSES = ["dostępny", "wkrótce", "ukryty"];
const TYPES = ["pdf", "audio", "wideo", "kurs", "usluga", "karta"];
const AUDIENCES = ["Mężczyzna", "Kobieta", "Ojciec", "Matka", "Mąż", "Żona", "Lider"];

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

// Liczba >= 0 → wartość; w przeciym razie NULL.
function numVal(v) {
  if (v === "" || v === null || v === undefined) return "NULL";
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? String(n) : "NULL";
}

// Integer z przedziału; poza nim NULL.
function intVal(v, min, max) {
  if (v === "" || v === null || v === undefined) return "NULL";
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? String(n) : "NULL";
}

// Data YYYY-MM-DD albo NULL.
function dateVal(v) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? escStr(v.trim()) : "NULL";
}

// Drabinka cen: [{ do: "RRRR-MM-DD", cena }] — posortowana, bez duplikatów dat, najwyżej 6 progów; pusta → NULL.
function stepsVal(v) {
  const steps = readSteps({ price_steps: v });
  const seen = new Set();
  const clean = steps.filter((s) => !seen.has(s.do) && seen.add(s.do)).slice(0, 6);
  if (Array.isArray(v) && v.length && clean.length !== v.length) throw new Error("Drabinka cen: każdy próg potrzebuje daty „do” i ceny (bez powtórzeń dat, najwyżej 6 progów).");
  return clean.length ? `${escStr(JSON.stringify(clean))}::jsonb` : "NULL";
}

// Premiera o czasie: ISO albo NULL (tylko przyszłość ma sens, ale przeszła data po prostu wykona się przy najbliższym przebiegu).
function releaseVal(v) {
  if (!v) return "NULL";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "NULL" : `${escStr(d.toISOString())}::timestamptz`;
}

// Wartość z listy dozwolonych albo NULL.
function pickVal(v, allowed) {
  return allowed.includes(v) ? escStr(v) : "NULL";
}

function buildValues(p, name, slug, price, oldPrice, category) {
  return {
    // Pola klasyczne (strona produktu, koszyk)
    name: escStr(name),
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
    // Pola Skarbca (drabina powrotu)
    level: intVal(p.level, 0, 5),
    stage: pickVal(p.stage, STAGES),
    form: pickVal(p.form, FORMS),
    audience_tags: arrVal(p.audience_tags),
    promise: textVal(p.promise, 500),
    for_whom: textVal(p.for_whom, 300),
    format_details: textVal(p.format_details, 200),
    price_start: numVal(p.price_start),
    price_regular: numVal(p.price_regular),
    is_free: p.is_free ? "TRUE" : "FALSE",
    status: p.status && STATUSES.includes(p.status) ? escStr(p.status) : "'dostępny'",
    promo_end_date: dateVal(p.promo_end_date),
    button_label: textVal(p.button_label, 200),
    checkout_url: textVal(p.checkout_url, 1000),
    next_step: textVal(p.next_step, 300),
    is_featured: p.is_featured ? "TRUE" : "FALSE",
    sort_order: intVal(p.sort_order, 0, 9999),
    cover_image: textVal(p.cover_image, 1000),
    file_url: textVal(p.file_url, 1000),
    product_type: pickVal(p.product_type, TYPES) === "NULL" ? "'usluga'" : pickVal(p.product_type, TYPES),
    access_months: intVal(p.access_months, 1, 120),
    private_file_uri: textVal(p.private_file_uri, 1000),
    private_file_name: textVal(p.private_file_name, 300),
    price_steps: stepsVal(p.price_steps),
  };
}

const SHOP_COLUMNS = `name, slug, subtitle, description, long_description, price, old_price, category, image_url,
  gallery, featured, active, details, format, duration, spots,
  level, stage, form, audience_tags, promise, for_whom, format_details,
  price_start, price_regular, is_free, status, promo_end_date,
  button_label, checkout_url, next_step, is_featured, sort_order, cover_image, file_url,
  product_type, access_months, private_file_uri, private_file_name, price_steps`;

const SHOP_SELECT = `id, name, slug, subtitle, description, long_description,
  price::float8 AS price, old_price::float8 AS old_price, category, image_url, gallery,
  featured, active, details, format, duration, spots,
  level, stage, form, audience_tags, promise, for_whom, format_details,
  price_start::float8 AS price_start, price_regular::float8 AS price_regular,
  is_free, status, promo_end_date::text AS promo_end_date,
  button_label, checkout_url, next_step, is_featured, sort_order, cover_image, created_date, updated_date,
  to_jsonb(p)->>'release_at' AS release_at, to_jsonb(p)->>'release_note' AS release_note,
  (SELECT COUNT(*)::int FROM public.waitlist w WHERE w.product_id = p.id) AS waitlist_count`;

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await requireAdmin(base44);
    const body = await req.json().catch(() => ({}));

    if (body.action === "list") {
      const products = await runSql(
        base44,
        `SELECT p.id, p.name, p.slug, p.subtitle, p.description, p.long_description,
                p.price::float8 AS price, p.old_price::float8 AS old_price, p.category, p.image_url, p.gallery,
                p.featured, p.active, p.details, p.format, p.duration, p.spots,
                p.level, p.stage, p.form, p.audience_tags, p.promise, p.for_whom, p.format_details,
                p.price_start::float8 AS price_start, p.price_regular::float8 AS price_regular,
                p.is_free, p.status, p.promo_end_date::text AS promo_end_date,
                p.button_label, p.checkout_url, p.next_step, p.is_featured, p.sort_order, p.cover_image, p.file_url,
                p.product_type, p.access_months, p.private_file_uri, p.private_file_name,
                to_jsonb(p)->'price_steps' AS price_steps,
                p.created_date, p.updated_date,
                (SELECT COUNT(*)::int FROM public.waitlist w WHERE w.product_id = p.id) AS waitlist_count
         FROM public.products p
         ORDER BY p.level ASC NULLS LAST, p.sort_order ASC NULLS LAST, p.created_date DESC
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

      await runSql(
        base44,
        `ALTER TABLE public.products ADD COLUMN IF NOT EXISTS file_url text, ADD COLUMN IF NOT EXISTS price_steps jsonb, ADD COLUMN IF NOT EXISTS available_at timestamptz`
      );

      if (p.id) {
        await runSql(
          base44,
          `UPDATE public.products SET
             name = ${v.name}, slug = ${v.slug}, subtitle = ${v.subtitle}, description = ${v.description},
             long_description = ${v.long_description}, price = ${v.price}, old_price = ${v.old_price},
             category = ${v.category}, image_url = ${v.image_url}, gallery = ${v.gallery},
             featured = ${v.featured}, active = ${v.active}, details = ${v.details},
             format = ${v.format}, duration = ${v.duration}, spots = ${v.spots},
             level = ${v.level}, stage = ${v.stage}, form = ${v.form}, audience_tags = ${v.audience_tags},
             promise = ${v.promise}, for_whom = ${v.for_whom}, format_details = ${v.format_details},
             price_start = ${v.price_start}, price_regular = ${v.price_regular}, is_free = ${v.is_free},
             status = ${v.status}, promo_end_date = ${v.promo_end_date},
             button_label = ${v.button_label}, checkout_url = ${v.checkout_url}, next_step = ${v.next_step},
             is_featured = ${v.is_featured}, sort_order = ${v.sort_order}, cover_image = ${v.cover_image},
             file_url = ${v.file_url},
             product_type = ${v.product_type}, access_months = ${v.access_months},
             private_file_uri = ${v.private_file_uri}, private_file_name = ${v.private_file_name},
             price_steps = ${v.price_steps},
             -- chwila premiery („wkrótce”/ukryty → „dostępny”) — dla powiadomień klientów o nowościach
             available_at = CASE WHEN ${v.status} = 'dostępny' AND COALESCE(status, 'dostępny') <> 'dostępny' THEN now() ELSE available_at END,
             updated_date = now()
           WHERE id = ${escStr(String(p.id))}`
        );
      } else {
        await runSql(
          base44,
          `INSERT INTO public.products
             (${SHOP_COLUMNS}, created_by_id)
           VALUES (${v.name}, ${v.slug}, ${v.subtitle}, ${v.description}, ${v.long_description}, ${v.price}, ${v.old_price},
                   ${v.category}, ${v.image_url}, ${v.gallery}, ${v.featured}, ${v.active}, ${v.details},
                   ${v.format}, ${v.duration}, ${v.spots},
                   ${v.level}, ${v.stage}, ${v.form}, ${v.audience_tags}, ${v.promise}, ${v.for_whom}, ${v.format_details},
                   ${v.price_start}, ${v.price_regular}, ${v.is_free}, ${v.status}, ${v.promo_end_date},
                   ${v.button_label}, ${v.checkout_url}, ${v.next_step}, ${v.is_featured}, ${v.sort_order}, ${v.cover_image},
                   ${v.file_url}, ${v.product_type}, ${v.access_months}, ${v.private_file_uri}, ${v.private_file_name},
                   ${v.price_steps}, ${escStr(user.id)})`
        );
        await runSql(
          base44,
          `UPDATE public.products SET available_at = now() WHERE slug = ${v.slug} AND available_at IS NULL AND COALESCE(status, 'dostępny') = 'dostępny' AND active = TRUE`
        );
      }
      await ensureWaitlistCols(base44);
      const rel = p.status === "wkrótce" ? releaseVal(p.release_at) : "NULL";
      await runSql(base44, `UPDATE public.products SET release_at = ${rel}, release_note = ${rel === "NULL" ? "NULL" : textVal(p.release_note, 1500)} WHERE slug = ${v.slug}`);
      await recordPrices(base44, true).catch(() => {}); // historia cen (Omnibus) od razu po zmianie
      await clearSnap(base44, "products:").catch(() => {}); // katalog w Skarbcu odświeży się przy najbliższym wejściu
      return Response.json({ ok: true });
    }

    // Lista oczekujących produktu: kto, kiedy, czy już powiadomiony.
    if (body.action === "waitlist") {
      const id = String(body.id || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Brak produktu");
      await ensureWaitlistCols(base44);
      const rows = await runSql(base44, `SELECT email, first_name, created_at::text AS created_at, notified_at::text AS notified_at
        FROM public.waitlist WHERE product_id = ${escStr(id)} ORDER BY created_at ASC LIMIT 5000`, true);
      return Response.json({ rows });
    }

    // Powiadomienie „już dostępne”: partia do 20 osób na wywołanie (panel woła w pętli), każda osoba najwyżej raz.
    if (body.action === "waitlist_notify") {
      const id = String(body.id || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Brak produktu");
      await requireMail(base44);
      return Response.json(await notifyBatch(base44, id, String(body.note || "").slice(0, 1500).trim()));
    }

    if (body.action === "delete") {
      const id = String(body.id || "");
      if (!id) throw new Error("Brak id produktu");
      await runSql(base44, `DELETE FROM public.products WHERE id = ${escStr(id)}`);
      await clearSnap(base44, "products:").catch(() => {});
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