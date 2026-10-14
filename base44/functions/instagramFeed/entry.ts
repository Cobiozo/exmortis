import { createClientFromRequest } from "npm:@base44/sdk@0.8.49";
import { clientIp } from "../../shared/supabase.ts";

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

export default async function (req) {
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