import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, escStr, requireAdmin } from "../../shared/supabase.ts";
import { ensureReviewsTable, plainText } from "../../shared/reviews.ts";
import { clearSnap } from "../../shared/snapshot.ts";

// Panel Skarbca → OPINIE (tylko rola admin).
// list   — lista z filtrem statusu + liczniki.
// status — publikacja / odrzucenie / ukrycie ponownie.
// reply  — odpowiedź exmortis (czysty tekst). Treści opinii nie da się zmienić — to jest jej autentyczność.
const STATUSES = ["oczekuje", "opublikowana", "odrzucona"];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    await requireAdmin(base44);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "list");
    await ensureReviewsTable(base44);

    if (action === "list") {
      const status = STATUSES.includes(String(body.status)) ? String(body.status) : "oczekuje";
      const [rows, counts] = await Promise.all([
        runSql(
          base44,
          `SELECT r.id, r.product_id, r.order_id, r.display_name, r.rating, r.body, r.status, r.reply,
                  r.created_at, r.published_at, p.name AS product_name, p.slug AS product_slug
           FROM public.product_reviews r LEFT JOIN public.products p ON p.id::text = r.product_id
           WHERE r.status = ${escStr(status)} ORDER BY r.created_at DESC LIMIT 200`,
          true
        ),
        runSql(base44, `SELECT status, count(*)::int AS c FROM public.product_reviews GROUP BY status`, true).catch(() => []),
      ]);
      return Response.json({
        reviews: rows || [],
        counts: Object.fromEntries((counts || []).map((c) => [String(c.status), Number(c.c) || 0])),
        status,
      });
    }

    // Sam licznik oczekujących (dla przycisku w panelu Skarbca).
    if (action === "counts") {
      const counts = await runSql(base44, `SELECT status, count(*)::int AS c FROM public.product_reviews GROUP BY status`, true).catch(() => []);
      return Response.json({ counts: Object.fromEntries((counts || []).map((c) => [String(c.status), Number(c.c) || 0])) });
    }

    const id = String(body.id || "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Nieprawidłowa opinia" }, { status: 400 });

    if (action === "status") {
      const status = STATUSES.includes(String(body.status)) ? String(body.status) : "";
      if (!status) return Response.json({ error: "Nieprawidłowy status" }, { status: 400 });
      await runSql(
        base44,
        `UPDATE public.product_reviews
         SET status = ${escStr(status)},
             published_at = CASE WHEN ${escStr(status)} = 'opublikowana' THEN COALESCE(published_at, now()) ELSE published_at END
         WHERE id = ${escStr(id)}`
      );
      // Średnia na karcie produktu liczy się z kopii katalogu — oznaczamy ją jako starą
      // przy każdej zmianie statusu (publikacja, odrzucenie, ukrycie ponownie).
      await clearSnap(base44, "products:").catch(() => {});
      return Response.json({ ok: true });
    }

    if (action === "reply") {
      const raw = String(body.reply ?? "").trim();
      const reply = raw ? plainText(raw, { min: 1, max: 600, label: "Odpowiedź" }) : null;
      await runSql(base44, `UPDATE public.product_reviews SET reply = ${reply ? escStr(reply) : "NULL"} WHERE id = ${escStr(id)}`);
      return Response.json({ ok: true, reply });
    }

    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (error) {
    if (String(error?.message || "").includes("FORBIDDEN")) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
    const bad = /^(Opinia|Podpis|Odpowiedź)/.test(String(error?.message || ""));
    return Response.json({ error: error.message }, { status: bad ? 400 : 500 });
  }
}