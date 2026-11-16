import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, escStr, clientIp } from "../../shared/supabase.ts";
import { isActive } from "../../shared/access.ts";
import { accessFilter, accessGet } from "../../shared/mirror.ts";
import { nextStep } from "../../shared/nextStep.ts";
import { accessFileResponse } from "../../shared/accessFile.ts";

// Konto klienta: moje produkty, zakupy, podpisany link do pliku (po sprawdzeniu dostępu).
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me) return Response.json({ error: "Zaloguj się" }, { status: 401 });
    if (me.role === "zablokowane") return Response.json({ error: "To konto jest zablokowane." }, { status: 403 }); // stare konto po zmianie adresu
    const email = String(me.email).toLowerCase();
    const body = await req.json().catch(() => ({}));

    if (body.action === "products") {
      const list = (await accessFilter(base44, { user_email: email }, "-created_date", 200)).filter((a) => !a.revoked);
      if (!list.length) return Response.json({ products: [] });
      const ids = [...new Set(list.map((a) => a.product_id))].map(escStr).join(",");
      const rows = await runSql(
        base44,
        `SELECT id, name, slug, subtitle, cover_image, image_url, product_type,
                (private_file_uri IS NOT NULL OR file_url IS NOT NULL) AS has_file
         FROM public.products WHERE id::text IN (${ids})`,
        true
      );
      const byId = new Map(rows.map((r) => [String(r.id), r]));
      const products = list.map((a) => {
        const p = byId.get(a.product_id) || {};
        return {
          access_id: a.id,
          name: p.name || a.product_name,
          slug: p.slug,
          subtitle: p.subtitle,
          cover: p.cover_image || p.image_url || null,
          type: p.product_type || a.product_type,
          valid_until: a.valid_until || null,
          active: isActive(a),
          has_file: !!p.has_file,
        };
      });
      // Postęp kursów: ukończone / widoczne lekcje (bez wpływu na resztę listy przy błędzie).
      await Promise.all(products.filter((p) => (p.type === "kurs" || p.type === "wideo") && p.active).map(async (p) => {
        try {
          const a = list.find((x) => x.id === p.access_id);
          const [lessons, prog] = await Promise.all([
            base44.asServiceRole.entities.CourseLesson.filter({ product_id: a.product_id, published: true }, "order", 300),
            base44.asServiceRole.entities.LessonProgress.filter({ user_email: email, product_id: a.product_id, completed: true }, "-updated_date", 300),
          ]);
          const ids = new Set(lessons.map((l) => l.id));
          p.lessons_total = lessons.length;
          p.lessons_done = prog.filter((x) => ids.has(x.lesson_id)).length;
        } catch { /* bez postępu */ }
      }));
      const owned = list.map((a) => a.product_id);
      const next = await nextStep(base44, owned, owned).catch(() => null);
      return Response.json({ products, next });
    }

    if (body.action === "orders") {
      const orders = await runSql(
        base44,
        `SELECT id, created_date, items, total::float8 AS total, status,
                to_jsonb(o)->>'invoice_number' AS invoice_number, to_jsonb(o)->>'invoice_url' AS invoice_url
         FROM public.orders o WHERE lower(buyer_email) = ${escStr(email)}
         ORDER BY created_date DESC LIMIT 100`,
        true
      );
      // Składniki pakietów: pozycja pakietu pokazuje, co zawiera.
      const pids = [...new Set((orders || []).flatMap((o) => (Array.isArray(o.items) ? o.items : []).map((i) => i?.product_id).filter(Boolean).map(String)))];
      const compNames = new Map();
      if (pids.length) {
        const pk = await runSql(base44, `SELECT id::text AS id, to_jsonb(p)->'bundle_items' AS bundle_items FROM public.products p WHERE id::text IN (${pids.map(escStr).join(",")})`, true).catch(() => []);
        const withItems = (pk || []).filter((r) => Array.isArray(r.bundle_items) && r.bundle_items.length);
        const cids = [...new Set(withItems.flatMap((r) => r.bundle_items.map(String)))];
        const comps = cids.length
          ? await runSql(base44, `SELECT id::text AS id, name FROM public.products WHERE id::text IN (${cids.map(escStr).join(",")})`, true).catch(() => [])
          : [];
        const nameById = new Map((comps || []).map((c) => [String(c.id), c.name]));
        for (const r of withItems) compNames.set(String(r.id), r.bundle_items.map(String).map((id) => nameById.get(id)).filter(Boolean));
      }
      const ordersOut = (orders || []).map((o) => ({
        ...o,
        items: (Array.isArray(o.items) ? o.items : []).map((i) => ({ ...i, components: compNames.get(String(i?.product_id)) || null })),
      }));
      // Karty podarunkowe kupione tym adresem — z linkiem do wersji do wydruku.
      const cards = await base44.asServiceRole.entities.DiscountCode.filter({ buyer_email: email }, "-created_date", 100).catch(() => []);
      const gift_cards = cards.filter((c) => c.gift_token).map((c) => ({
        token: c.gift_token, value: c.value, until: c.valid_until, to_name: c.gift_to || "",
        used: (Number(c.uses) || 0) >= (Number(c.max_uses) || 1) || c.active === false,
      }));
      return Response.json({ orders: ordersOut, gift_cards });
    }

    if (body.action === "file") {
      const a = await accessGet(base44, String(body.access_id || "")).catch(() => null);
      if (!a || a.user_email !== email || !isActive(a)) {
        return Response.json({ error: "Brak dostępu" }, { status: 403 });
      }
      return await accessFileResponse(base44, a, clientIp(req), email);
    }

    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Coś poszło nie tak. Spróbuj za chwilę." }, { status: 500 });
  }
}