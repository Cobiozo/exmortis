import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, escStr, requireAdmin } from "../../shared/supabase.ts";
import { clearSnap } from "../../shared/snapshot.ts";

const KEY_RE = /^[a-z0-9._-]+$/;

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    await requireAdmin(base44);
    const body = await req.json().catch(() => ({}));
    if (body.action !== "list") await clearSnap(base44, "content");

    if (body.action === "list") {
      const content = await runSql(
        base44,
        `SELECT page_key, block_key, value, updated_date
         FROM public.page_content
         ORDER BY page_key, block_key`,
        true
      );
      return Response.json({ content });
    }

    if (body.action === "save") {
      const page = String(body.page || "").trim();
      const key = String(body.key || "").trim();
      if (!KEY_RE.test(page) || !KEY_RE.test(key)) {
        throw new Error("Niepoprawny klucz bloku treści");
      }
      const json = JSON.stringify(body.value);
      if (json === undefined || json.length > 60000) {
        throw new Error("Wartość bloku jest niepoprawna lub zbyt duża");
      }
      await runSql(
        base44,
        `INSERT INTO public.page_content (id, page_key, block_key, value)
         VALUES (gen_random_uuid()::text, ${escStr(page)}, ${escStr(key)}, ${escStr(json)}::jsonb)
         ON CONFLICT (page_key, block_key)
         DO UPDATE SET value = ${escStr(json)}::jsonb, updated_date = now()`
      );
      return Response.json({ ok: true });
    }

    if (body.action === "delete") {
      const page = String(body.page || "").trim();
      const key = String(body.key || "").trim();
      if (!KEY_RE.test(page) || !KEY_RE.test(key)) {
        throw new Error("Niepoprawny klucz bloku treści");
      }
      await runSql(
        base44,
        `DELETE FROM public.page_content WHERE page_key = ${escStr(page)} AND block_key = ${escStr(key)}`
      );
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