import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, escStr, esc } from "../../shared/supabase.ts";

const MINUTES = [3, 5, 10, 15, 30, 60];
const SOUND_OPTIONS = ["cisza", "glos", "muzyka"];

// Publiczny, anonimowy zapis jednej sesji ciszy (bez danych osobowych).
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const minutes = Number(body.duration_minutes);
    if (!MINUTES.includes(minutes)) {
      return Response.json({ error: "Niepoprawny czas" }, { status: 400 });
    }
    const sound = SOUND_OPTIONS.includes(body.sound_option) ? body.sound_option : "cisza";
    const source =
      typeof body.source === "string" && body.source.trim() !== ""
        ? escStr(body.source.trim().slice(0, 100))
        : "NULL";

    await runSql(
      base44,
      `INSERT INTO public.silence_sessions (duration_minutes, completed, sound_option, source)
       VALUES (${minutes}, ${esc(!!body.completed)}, ${escStr(sound)}, ${source})`
    );
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}