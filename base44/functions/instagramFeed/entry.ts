import { createClientFromRequest } from "npm:@base44/sdk@0.8.49";
import { clientIp } from "../../shared/supabase.ts";
import { currentInstagramToken } from "../../shared/instagram.ts";

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
    // Token: sekret INSTAGRAM_ACCESS_TOKEN albo świeższy token odświeżony przez cronTick (app_settings).
    const token = await currentInstagramToken(base44).catch(() => "");
    // Brak tokenu nie psuje strony — sekcja na dole po prostu się nie pokazuje.
    if (!token) {
      console.error("instagramFeed: brak tokenu Instagrama — ustaw sekret INSTAGRAM_ACCESS_TOKEN");
      return Response.json({ username: null, posts: [] });
    }

    // Instagram Graph API: token jako parametr zapytania, nie nagłówek.
    const meRes = await fetch(
      `https://graph.instagram.com/me?fields=id,username&access_token=${encodeURIComponent(token)}`,
      { signal: AbortSignal.timeout(15000) }
    );
    const me = await meRes.json().catch(() => ({}));
    if (!me.id) {
      console.error("instagramFeed: profil nie odpowiedział —", String(me?.error?.message || meRes.status).slice(0, 120));
      return Response.json({ username: null, posts: [] });
    }

    const mediaRes = await fetch(
      `https://graph.instagram.com/${me.id}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink&limit=8&access_token=${encodeURIComponent(token)}`,
      { signal: AbortSignal.timeout(15000) }
    );
    const media = await mediaRes.json().catch(() => ({}));
    if (media?.error) console.error("instagramFeed: posty —", String(media.error.message).slice(0, 120));

    const posts = (media.data || []).map((p) => ({
      id: p.id,
      image: p.media_type === "VIDEO" ? p.thumbnail_url : p.media_url,
      permalink: p.permalink,
    }));

    const data = { username: me.username, posts: posts.slice(0, 6) };
    // Pustej odpowiedzi nie trzymamy w pamięci — sekcja pojawi się od razu po naprawie tokenu.
    if (data.posts.length) CACHE = { at: Date.now(), data };
    return Response.json(data);
  } catch (error) {
    // Instagram nigdy nie wywraca strony: pusta lista zamiast błędu (token nie trafia do logu).
    console.error("instagramFeed:", String(error?.message || error).slice(0, 120));
    return Response.json({ username: null, posts: [] });
  }
}