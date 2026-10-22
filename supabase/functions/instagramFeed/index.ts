import { createClientFromRequest } from "../_shared/compat.ts";
import { clientIp } from "../_shared/supabase.ts";

// Zwraca najnowsze posty z Instagrama (profil podłączony przez connector).
// Endpoint publiczny — strona główna wyświetla te posty także niezalogowanym.
// Wynik trzymany 10 minut w pamięci instancji: jedno wywołanie do Instagrama obsługuje
// wszystkich gości, więc publiczny adres nie służy jako darmowe proxy do API.
const TTL = 600000;
const HITS = new Map();
let CACHE = null;

function limited(ip) {
  const now = Date.now();
  const arr = (HITS.get(ip) || []).filter((t) => now - t < 60000);
  arr.push(now);
  HITS.set(ip, arr);
  if (HITS.size > 5000) HITS.clear();
  return arr.length > 60;
}

const handler = async function (req) {
  try {
    const ip = clientIp(req);
    if (ip !== "brak" && limited(ip)) return Response.json({ error: "Zbyt wiele żądań" }, { status: 429 });
    if (CACHE && Date.now() - CACHE.at < TTL) return Response.json(CACHE.data);

    const base44 = createClientFromRequest(req);
    const { accessToken } = await base44.asServiceRole.connectors.getConnection("instagram");

    // Instagram Graph API: token jako parametr zapytania, nie nagłówek.
    const meRes = await fetch(
      `https://graph.instagram.com/me?fields=id,username&access_token=${accessToken}`
    );
    const me = await meRes.json();
    if (!me.id) {
      return Response.json({ error: "Brak profilu Instagram" }, { status: 502 });
    }

    const mediaRes = await fetch(
      `https://graph.instagram.com/${me.id}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink&limit=8&access_token=${accessToken}`
    );
    const media = await mediaRes.json();

    const posts = (media.data || []).map((p) => ({
      id: p.id,
      image: p.media_type === "VIDEO" ? p.thumbnail_url : p.media_url,
      permalink: p.permalink,
    }));

    const data = { username: me.username, posts: posts.slice(0, 6) };
    CACHE = { at: Date.now(), data };
    return Response.json(data);
  } catch (error) {
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
