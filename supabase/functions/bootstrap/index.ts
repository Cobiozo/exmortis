import { createClientFromRequest } from "../_shared/compat.ts";
import { publicSettings, publicContent, publicEvent } from "../_shared/publicData.ts";

// Jedno wywołanie startowe gościa: ustawienia + treści + strona z edytora + spotkanie.
// { ping: true } — rozgrzewanie, bez odczytów i zapisów.
const SLUG = /^[a-z0-9-]{1,100}$/;

const handler = async function (req) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body.ping) return Response.json({ ok: true });
    const base44 = createClientFromRequest(req);
    const page = SLUG.test(String(body.page || "")) ? body.page : null;
    const event = SLUG.test(String(body.event || "")) ? body.event : null;
    const part = (p) => p.catch((e) => { console.error("bootstrap", e.message); return undefined; });
    const [settings, content, pages, ev] = await Promise.all([
      part(publicSettings(base44, req)),
      part(publicContent(base44)),
      page ? part(base44.asServiceRole.entities.PublishedPage.filter({ slug: page }, "-created_date", 1)) : null,
      event ? part(publicEvent(base44, event)) : null,
    ]);
    return Response.json({ settings, content, page: pages ? pages[0] || null : undefined, event: ev });
  } catch (error) {
    console.error("bootstrap", error?.message);
    return Response.json({ error: "Chwilowy problem z danymi strony. Odśwież za chwilę." }, { status: 500 });
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
