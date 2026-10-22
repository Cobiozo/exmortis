import { createClientFromRequest } from "../_shared/compat.ts";
import { publicSettings } from "../_shared/publicData.ts";

// Publiczne ustawienia strony: dane firmy i tryb przedpremierowy.
const handler = async function (req) {
  try {
    return Response.json(await publicSettings(createClientFromRequest(req), req));
  } catch (error) {
    console.error("siteSettings", error?.message);
    return Response.json({ error: "Chwilowy problem z ustawieniami. Odśwież za chwilę." }, { status: 500 });
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
