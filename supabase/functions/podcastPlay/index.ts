import { createClientFromRequest } from "../_shared/compat.ts";
import { clientIp } from "../_shared/supabase.ts";
import { ipAllowed } from "../_shared/rateLimit.ts";

// Zliczanie odtworzeń odcinka. RLS pozwala zapisywać odcinki tylko administratorowi,
// więc odwiedzający zwiększają licznik przez tę wąską funkcję (maks. 30 startów/godz. z jednego IP).
const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const b = await req.json().catch(() => ({}));
    const id = String(b.id || "").trim();
    if (!id) return Response.json({ error: "Brak odcinka." }, { status: 400 });
    if (!(await ipAllowed(base44, clientIp(req), "podcast_odsluch", 30, 3600000))) {
      return Response.json({ ok: true }); // cicho — licznik nie jest ważniejszy od słuchania
    }
    const ep = await base44.asServiceRole.entities.PodcastEpisode.get(id).catch(() => null);
    if (!ep || !ep.id) return Response.json({ error: "Nie ma takiego odcinka." }, { status: 404 });
    // $inc zwiększa licznik w bazie — równoległe odtworzenia nie nadpisują się nawzajem.
    await base44.asServiceRole.entities.PodcastEpisode.updateMany({ id: ep.id }, { $inc: { odtworzenia: 1 } });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
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
