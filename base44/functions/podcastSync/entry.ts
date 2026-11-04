import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql } from "../../shared/supabase.ts";
import { importPodcastRss } from "../../shared/podcastRss.ts";
import { exmClient } from "../../shared/exmEntities.ts";

// Automatyczne pobieranie nowych odcinków z kanału RSS (Spotify for Creators / anchor.fm).
// Wołane w tle przez stronę podcastu i stronę główną; samo nic nie przyjmuje od odwiedzającego.
// Blokada w app_settings (klucz 'podcast_rss'): najwyżej jeden import na 20 minut, więc ruch na stronie
// nie zamienia się w zapytania do kanału. Zapis idzie do danych strony (exm_*), jak przycisk w panelu.
const EVERY_MIN = 20;

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const lock = await runSql(base44, `INSERT INTO public.app_settings (key, value, updated_date)
        VALUES ('podcast_rss', jsonb_build_object('at', now()), now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_date = now()
        WHERE public.app_settings.updated_date < now() - interval '${EVERY_MIN} minutes'
      RETURNING key`).catch(() => []);
    if (!lock || !lock.length) return Response.json({ ok: true, pominiete: true });
    const wynik = await importPodcastRss(exmClient(base44));
    return Response.json({ ok: true, dodane: wynik.dodane, odcinki: wynik.odcinki });
  } catch (e) {
    console.error("podcastSync", String(e?.message || e).slice(0, 200));
    return Response.json({ ok: false }, { status: 200 });
  }
}
