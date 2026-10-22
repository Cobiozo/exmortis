import { createClientFromRequest } from "../_shared/compat.ts";
import { runSql, escStr, requireStaff as requireAdmin } from "../_shared/supabase.ts";
import { clearSnap } from "../_shared/snapshot.ts";

const KEY_RE = /^[a-z0-9._-]+$/;

const handler = async function (req) {
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

// === Supabase Edge (wygenerowane przez docs/tech/migruj.mjs) ===
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const res = await handler(req);
    const h = new Headers(res.headers);
    for (const [k, v] of Object.entries(CORS)) h.set(k, v);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  } catch (e) {
    const msg = String(e?.message || e);
    const status = msg === "FORBIDDEN" ? 403 : e && e.isValidation ? 400 : 500;
    console.error("edge:", msg.slice(0, 300));
    return Response.json({ error: msg.slice(0, 300) }, { status, headers: CORS });
  }
});
