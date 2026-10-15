import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, escStr, clientIp } from "../../shared/supabase.ts";
import { joinToken } from "../../shared/events.ts";
import { normalizeServerVideo, normalizeVideo } from "../../shared/libraryMedia.ts";
import { libSettings } from "../../shared/libraryAccess.ts";
import { signServerVideo } from "../../shared/videoSign.ts";
import { checkVideoAbuse } from "../../shared/videoGuard.ts";

// Moje konto → Spotkania: zapisy zalogowanej osoby (po adresie e-mail) i nagrania.
// Nagranie widzi wyłącznie zalogowana osoba zapisana na spotkanie (Zapisany/Obecny),
// tylko w oknie udostępnienia (recording_until w przyszłości). Adres pliku nigdy nie trafia do list —
// odtwarzacz dostaje krótko ważny, podpisany link dopiero przy „play”.
const END = `e.start_datetime + (COALESCE(e.duration_minutes,60) * interval '1 minute')`;
const OK_REG = `('Zapisany','Obecny')`;

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.email) return Response.json({ error: "Zaloguj się" }, { status: 401 });
    if (me.role === "zablokowane") return Response.json({ error: "To konto jest zablokowane." }, { status: 403 }); // stare konto po zmianie adresu
    const email = String(me.email).trim().toLowerCase();
    const admin = me.role === "admin";
    const body = await req.json().catch(() => ({}));

    if (body.action === "list") {
      const rows = await runSql(base44,
        `SELECT r.id AS reg_id, r.status AS reg_status, r.cancel_token, e.id, e.title, e.slug, e.short_path, e.format,
                e.status, e.start_datetime, e.duration_minutes, e.recording_until,
                (e.recording_url IS NOT NULL) AS has_rec, (${END} < now()) AS ended,
                (e.recording_url IS NOT NULL AND e.recording_until IS NOT NULL AND e.recording_until > now()
                  AND ${END} < now() AND e.status = 'Opublikowane') AS rec_open
           FROM public.registrations r JOIN public.events e ON e.id = r.event_id
          WHERE lower(r.email) = ${escStr(email)} AND r.status IN ('Zapisany','Obecny','Lista rezerwowa')
            AND e.start_datetime IS NOT NULL AND e.status IN ('Opublikowane','Odwołane')
          ORDER BY e.start_datetime DESC LIMIT 60`, true);
      const items = await Promise.all((rows || []).map(async (r) => {
        const registered = ["Zapisany", "Obecny"].includes(r.reg_status);
        const t = registered && r.format === "Online" && !r.ended ? await joinToken(r.cancel_token) : null;
        const path = r.short_path ? `/${r.short_path}/dolacz` : `/spotkania/${r.slug}/dolacz`;
        return {
          id: r.id, title: r.title, start_datetime: r.start_datetime, duration_minutes: r.duration_minutes,
          format: r.format, status: r.status, reg_status: r.reg_status, ended: !!r.ended,
          join_url: t ? `${path}?t=${t}` : null,
          recording: registered && r.rec_open ? { until: r.recording_until } : null,
          recording_was: registered && r.has_rec && r.ended && !r.rec_open,
        };
      }));
      return Response.json({ items });
    }

    if (body.action === "play" || body.action === "violation") {
      const id = String(body.event_id || "").slice(0, 80);
      const ev = (await runSql(base44,
        `SELECT e.id, e.title, e.status, e.recording_url, e.recording_until, (${END} < now()) AS ended
           FROM public.events e WHERE e.id = ${escStr(id)}`, true))[0];
      const reg = ev && (await runSql(base44,
        `SELECT id FROM public.registrations WHERE event_id = ${escStr(id)} AND lower(email) = ${escStr(email)}
            AND status IN ${OK_REG} LIMIT 1`, true))[0];
      const ip = clientIp(req);

      if (body.action === "violation") {
        if (ev) await base44.asServiceRole.entities.SecurityLog.create({ type: "znak_wodny", user_email: email, ip, details: `Nagranie: ${ev.title}` }).catch(() => {});
        return Response.json({ ok: true });
      }

      const until = ev?.recording_until ? new Date(ev.recording_until).getTime() : 0;
      const open = !!ev && !!ev.recording_url && ev.status === "Opublikowane" && ev.ended && until > Date.now();
      // Administrator może sprawdzić nagranie zawsze (podgląd), klient — tylko jako zapisany, w oknie udostępnienia.
      if (!ev || !ev.recording_url || (!admin && (!reg || !open))) {
        return Response.json({ error: "To nagranie nie jest już dostępne." }, { status: 403 });
      }
      const blocked = await checkVideoAbuse(base44, email, ip);
      if (blocked) return Response.json({ error: blocked }, { status: 429 });

      const s = await libSettings(base44).catch(() => null);
      const server = normalizeServerVideo(ev.recording_url, s?.video_domains || []);
      const embed = server ? null : normalizeVideo(ev.recording_url);
      if (!server && !embed) return Response.json({ error: "Nagranie jest chwilowo niedostępne." }, { status: 502 });
      await base44.asServiceRole.entities.PlaybackLog.create({
        user_email: email, product_id: `spotkanie:${ev.id}`, lesson_id: `nagranie:${ev.id}`, lesson_title: `Nagranie: ${ev.title}`,
        ip, user_agent: (req.headers.get("user-agent") || "").slice(0, 300),
      }).catch(() => {});
      const license = String(reg?.id || "ADMIN").replace(/-/g, "").slice(-8).toUpperCase();
      const left = until > Date.now() ? Math.floor((until - Date.now()) / 1000) : null;
      if (embed) return Response.json({ embed: embed.embed, provider: embed.provider, license, until: ev.recording_until });
      // Podpisany link (ochrona włączona) nie przeżyje końca okna udostępnienia.
      const signed = await signServerVideo(base44, server, null, left).catch(() => null);
      return Response.json({ url: signed?.url || server, server: true, expires_in: signed?.expires_in || null, protected: !!signed, license, until: ev.recording_until });
    }

    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
