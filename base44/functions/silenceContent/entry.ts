import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql } from "../../shared/supabase.ts";

// Publiczne ustawienia Minutnika ciszy: które dźwięki są dostępne + podpisane adresy plików.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const rows = await runSql(
      base44,
      `SELECT intro_uri, outro_uri, background_uri
       FROM public.silence_settings
       WHERE id = 1`,
      true
    );
    const s = rows && rows[0] ? rows[0] : {};

    const sign = async (uri) => {
      if (!uri) return null;
      try {
        const res = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
          file_uri: uri,
          expires_in: 7200,
        });
        return res.signed_url || null;
      } catch {
        return null;
      }
    };

    const [introUrl, outroUrl, backgroundUrl] = await Promise.all([
      sign(s.intro_uri),
      sign(s.outro_uri),
      sign(s.background_uri),
    ]);

    return Response.json({
      has_voice: !!(s.intro_uri && s.outro_uri),
      has_music: !!s.background_uri,
      intro_url: introUrl,
      outro_url: outroUrl,
      background_url: backgroundUrl,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}