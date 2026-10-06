import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, escStr } from "../../shared/supabase.ts";
import { isActive } from "../../shared/access.ts";

// Konto klienta: moje produkty, zakupy, podpisany link do pliku (po sprawdzeniu dostępu).
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me) return Response.json({ error: "Zaloguj się" }, { status: 401 });
    const email = String(me.email).toLowerCase();
    const body = await req.json().catch(() => ({}));
    const Access = base44.asServiceRole.entities.Access;

    if (body.action === "products") {
      const list = (await Access.filter({ user_email: email }, "-created_date", 200)).filter((a) => !a.revoked);
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
      return Response.json({ products });
    }

    if (body.action === "orders") {
      const orders = await runSql(
        base44,
        `SELECT id, created_date, items, total::float8 AS total, status
         FROM public.orders WHERE lower(buyer_email) = ${escStr(email)}
         ORDER BY created_date DESC LIMIT 100`,
        true
      );
      return Response.json({ orders });
    }

    if (body.action === "file") {
      const a = await Access.get(String(body.access_id || "")).catch(() => null);
      if (!a || a.user_email !== email || !isActive(a)) {
        return Response.json({ error: "Brak dostępu" }, { status: 403 });
      }
      const rows = await runSql(
        base44,
        `SELECT private_file_uri, private_file_name, file_url FROM public.products WHERE id::text = ${escStr(a.product_id)} LIMIT 1`,
        true
      );
      const p = rows[0];
      if (p?.private_file_uri) {
        const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
          file_uri: p.private_file_uri,
          expires_in: 600,
        });
        return Response.json({ url: signed_url, name: p.private_file_name || "plik" });
      }
      if (p?.file_url) return Response.json({ url: p.file_url, name: "plik" });
      return Response.json({ error: "Plik nie jest jeszcze gotowy" }, { status: 404 });
    }

    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}