import { createClientFromRequest } from "../_shared/compat.ts";
import { clientIp } from "../_shared/supabase.ts";
import { currentInstagramToken } from "../_shared/instagram.ts";

// Zwraca 6 najnowszych postów i rolek z Instagrama (od najnowszych); miniatury podaje przez exmortis.pl.
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

// Pobranie feedu z Instagram Graph API (najnowsze posty i rolki, od najnowszych). Bez tokenu albo przy błędzie — pusta lista.
async function loadFeed(base44) {
  // Token: sekret INSTAGRAM_ACCESS_TOKEN albo świeższy token odświeżony przez cronTick (app_settings).
  const token = await currentInstagramToken(base44).catch(() => "");
  if (!token) {
    console.error("instagramFeed: brak tokenu Instagrama — ustaw sekret INSTAGRAM_ACCESS_TOKEN");
    return null;
  }
  // Instagram Graph API: token jako parametr zapytania, nie nagłówek.
  const meRes = await fetch(
    `https://graph.instagram.com/me?fields=id,username&access_token=${encodeURIComponent(token)}`,
    { signal: AbortSignal.timeout(15000) }
  );
  const me = await meRes.json().catch(() => ({}));
  if (!me.id) {
    console.error("instagramFeed: profil nie odpowiedział —", String(me?.error?.message || meRes.status).slice(0, 120));
    return null;
  }
  const mediaRes = await fetch(
    `https://graph.instagram.com/${me.id}/media?fields=id,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp&limit=12&access_token=${encodeURIComponent(token)}`,
    { signal: AbortSignal.timeout(15000) }
  );
  const media = await mediaRes.json().catch(() => ({}));
  if (media?.error) console.error("instagramFeed: posty —", String(media.error.message).slice(0, 120));
  const posts = (media.data || [])
    .map((p) => ({
      id: String(p.id),
      src: p.media_type === "VIDEO" ? p.thumbnail_url : p.media_url,
      permalink: p.permalink,
      reel: p.media_product_type === "REELS" || p.media_type === "VIDEO",
      at: p.timestamp || null,
    }))
    .filter((p) => p.src && /^https:\/\//.test(p.src))
    .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")))
    .slice(0, 6);
  return { username: me.username, posts };
}

async function feed(base44) {
  if (CACHE && Date.now() - CACHE.at < TTL) return CACHE.data;
  const data = await loadFeed(base44);
  // Pustej odpowiedzi nie trzymamy w pamięci — sekcja pojawi się od razu po naprawie tokenu.
  if (data?.posts?.length) CACHE = { at: Date.now(), data };
  return data;
}

// Publiczna odpowiedź: zdjęcia idą przez exmortis.pl (/functions/instagramFeed?img=…), więc przeglądarka
// odwiedzającego nie łączy się z serwerami Instagrama (Meta) i nie przekazuje im adresu IP — bez zgody na cookies.
const publicFeed = (d) => ({
  username: d.username,
  posts: d.posts.map((p) => ({ id: p.id, image: `/functions/instagramFeed?img=${encodeURIComponent(p.id)}`, permalink: p.permalink, reel: p.reel })),
});

const handler = async function (req) {
  try {
    const ip = clientIp(req);
    const url = new URL(req.url);
    const img = url.searchParams.get("img");
    const base44 = createClientFromRequest(req);

    // Miniatura posta: tylko z bieżącego feedu (nie jest to otwarte proxy do dowolnych adresów).
    if (img) {
      const d = await feed(base44);
      const p = d?.posts?.find((x) => x.id === img);
      if (!p) return new Response("Nie znaleziono", { status: 404 });
      const r = await fetch(p.src, { signal: AbortSignal.timeout(15000) });
      const type = r.headers.get("content-type") || "";
      if (!r.ok || !type.startsWith("image/")) return new Response("Obraz niedostępny", { status: 502 });
      return new Response(await r.arrayBuffer(), {
        status: 200,
        headers: { "content-type": type, "cache-control": "public, max-age=3600" },
      });
    }

    if (ip !== "brak" && limited(ip)) return Response.json({ error: "Zbyt wiele żądań" }, { status: 429 });
    const d = await feed(base44);
    // Brak tokenu albo błąd Instagrama nie psuje strony — sekcja na dole po prostu się nie pokazuje.
    if (!d?.posts?.length) return Response.json({ username: null, posts: [] });
    return Response.json(publicFeed(d));
  } catch (error) {
    // Instagram nigdy nie wywraca strony: pusta lista zamiast błędu (token nie trafia do logu).
    console.error("instagramFeed:", String(error?.message || error).slice(0, 120));
    return Response.json({ username: null, posts: [] });
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