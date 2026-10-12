import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, escStr, esc, clientIp } from "../../shared/supabase.ts";

const MINUTES = [5, 10, 15, 30, 45, 60];
// Anonimowe statystyki: najwyżej 60 zdarzeń na godzinę z jednego połączenia (licznik w pamięci instancji).
const HITS = new Map<string, number[]>();
function tooMany(ip: string) {
  const now = Date.now(), arr = (HITS.get(ip) || []).filter((t) => now - t < 3600000);
  arr.push(now); HITS.set(ip, arr);
  if (HITS.size > 5000) HITS.clear();
  return arr.length > 60;
}

// Publiczny, anonimowy zapis zdarzenia ciszy: cisza_start / cisza_ukonczona (bez danych osobowych).
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const ip = clientIp(req);
    if (ip !== "brak" && tooMany(ip)) return Response.json({ ok: true, skipped: true });
    const minutes = Number(body.duration_minutes);
    if (!MINUTES.includes(minutes)) {
      return Response.json({ error: "Niepoprawny czas" }, { status: 400 });
    }
    const withSound = !!body.with_sound;
    const str = (v) =>
      typeof v === "string" && v.trim() !== "" ? escStr(v.trim().slice(0, 100)) : "NULL";

    if (body.event === "cisza_ukonczona" && typeof body.session_id === "string") {
      await runSql(
        base44,
        `UPDATE public.silence_sessions SET completed = true
         WHERE id::text = ${escStr(body.session_id.slice(0, 64))}`
      );
      return Response.json({ ok: true });
    }

    const rows = await runSql(
      base44,
      `INSERT INTO public.silence_sessions (duration_minutes, completed, sound_option, source, soundtrack, with_sound, background)
       VALUES (${minutes}, false, ${escStr(withSound ? "muzyka" : "cisza")}, ${str(body.source)}, ${str(body.soundtrack)}, ${esc(withSound)}, ${str(body.background)})
       RETURNING id`
    );
    return Response.json({ ok: true, session_id: rows?.[0]?.id ? String(rows[0].id) : null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}