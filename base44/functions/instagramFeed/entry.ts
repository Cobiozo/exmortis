import { createClientFromRequest } from "npm:@base44/sdk@0.8.49";

// Zwraca najnowsze posty z Instagrama (profil podłączony przez connector).
// Endpoint publiczny — strona główna wyświetla te posty także niezalogowanym.
export default async function (req) {
  try {
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

    return Response.json({ username: me.username, posts: posts.slice(0, 6) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}