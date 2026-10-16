import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { clientIp } from "../../shared/supabase.ts";
import { ipAllowed } from "../../shared/rateLimit.ts";

// Zliczanie odtworzeń odcinka. RLS pozwala zapisywać odcinki tylko administratorowi,
// więc odwiedzający zwiększają licznik przez tę wąską funkcję (maks. 30 startów/godz. z jednego IP).
export default async function (req) {
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