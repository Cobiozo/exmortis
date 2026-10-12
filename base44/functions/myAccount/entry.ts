import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, escStr, clientIp } from "../../shared/supabase.ts";
import { isActive } from "../../shared/access.ts";
import { personalizePdf, newLicenseId } from "../../shared/pdfLicense.ts";

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
        `SELECT name, price::float8 AS price, product_type, private_file_uri, private_file_name, file_url FROM public.products WHERE id::text = ${escStr(a.product_id)} LIMIT 1`,
        true
      );
      const p = rows[0];
      const paidPdf = p?.private_file_uri && p.product_type === "pdf" && a.source !== "darmowy" && Number(p.price) > 0;
      if (paidPdf) {
        const sr = base44.asServiceRole;
        const orderNo = a.order_id ? String(a.order_id).slice(0, 8).toUpperCase() : "R-" + a.id.slice(-6).toUpperCase();
        let lic = (await sr.entities.License.filter({ access_id: a.id }))[0];
        if (!lic || lic.source_uri !== p.private_file_uri || !lic.file_uri) {
          const { signed_url } = await sr.integrations.Core.CreateFileSignedUrl({ file_uri: p.private_file_uri, expires_in: 120 });
          const orig = new Uint8Array(await (await fetch(signed_url)).arrayBuffer());
          const licenseId = lic?.license_id || newLicenseId();
          const out = await personalizePdf(orig, {
            email: a.user_email, orderNo, licenseId, title: p.name,
            date: (a.valid_from || a.created_date || "").slice(0, 10),
          });
          const { file_uri } = await sr.integrations.Core.UploadPrivateFile({
            file: new File([out], `${crypto.randomUUID()}.pdf`, { type: "application/pdf" }),
          });
          const data = { license_id: licenseId, access_id: a.id, user_email: a.user_email, product_id: a.product_id, product_name: p.name, order_id: a.order_id || "", file_uri, source_uri: p.private_file_uri };
          if (lic) { await sr.entities.License.update(lic.id, data); lic = { ...lic, ...data }; }
          else lic = await sr.entities.License.create({ ...data, downloads: 0 });
        }
        await sr.entities.License.update(lic.id, { downloads: (lic.downloads || 0) + 1 });
        await sr.entities.SecurityLog.create({ type: "pdf", user_email: email, ip: clientIp(req), details: `${p.name} · ${lic.license_id}` });
        const { signed_url } = await sr.integrations.Core.CreateFileSignedUrl({ file_uri: lic.file_uri, expires_in: 600 });
        const safe = String(p.name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
        return Response.json({ url: signed_url, name: `${safe}_exmortis_${orderNo}.pdf` });
      }
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
    console.error(error);
    return Response.json({ error: "Coś poszło nie tak. Spróbuj za chwilę." }, { status: 500 });
  }
}