import { createClientFromRequest } from "../_shared/compat.ts";
import { clientIp } from "../_shared/supabase.ts";
import { isActive } from "../_shared/access.ts";
import { checkVideoAbuse } from "../_shared/videoGuard.ts";
import { normalizeServerVideo, normalizeVideo } from "../_shared/libraryMedia.ts";
import { libSettings } from "../_shared/libraryAccess.ts";
import { signServerVideo } from "../_shared/videoSign.ts";

// Kurs klienta: spis lekcji, podpisany link do wideo (po sprawdzeniu dostępu), postęp.
const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me) return Response.json({ error: "Zaloguj się" }, { status: 401 });
    if (me.role === "zablokowane") return Response.json({ error: "To konto jest zablokowane." }, { status: 403 }); // stare konto po zmianie adresu
    const email = String(me.email).toLowerCase();
    const body = await req.json().catch(() => ({}));
    const sr = base44.asServiceRole.entities;

    const a = await sr.Access.get(String(body.access_id || "")).catch(() => null);
    if (!a || a.user_email !== email || !isActive(a) || !["wideo", "kurs"].includes(a.product_type)) {
      return Response.json({ error: "Brak dostępu" }, { status: 403 });
    }
    const pid = a.product_id;

    if (body.action === "outline") {
      const lessons = (await sr.CourseLesson.filter({ product_id: pid, published: true }, "order", 300));
      const prog = await sr.LessonProgress.filter({ user_email: email, product_id: pid }, "-updated_date", 300);
      const byL = new Map(prog.map((p) => [p.lesson_id, p]));
      return Response.json({
        name: a.product_name,
        valid_until: a.valid_until || null,
        lessons: lessons.map((l) => ({
          id: l.id, module: l.module || "", title: l.title, description: l.description || "",
          duration_min: l.duration_min || null, has_video: !!(l.video_uri || l.video_url),
          position_s: byL.get(l.id)?.position_s || 0, completed: !!byL.get(l.id)?.completed,
        })),
      });
    }

    const lesson = await sr.CourseLesson.get(String(body.lesson_id || "")).catch(() => null);
    if (!lesson || lesson.product_id !== pid || lesson.published === false) {
      return Response.json({ error: "Nie ma takiej lekcji" }, { status: 404 });
    }

    if (body.action === "play") {
      if (!lesson.video_uri && !lesson.video_url) return Response.json({ error: "Wideo jest przygotowywane" }, { status: 404 });
      // Adres zewnętrzny sprawdzany przy każdym odtworzeniu (zmiana listy domen działa od razu).
      let external = null;
      if (!lesson.video_uri) {
        const s = await libSettings(base44).catch(() => null);
        const server = normalizeServerVideo(lesson.video_url, s?.video_domains || []);
        const embed = server ? null : normalizeVideo(lesson.video_url);
        if (!server && !embed) return Response.json({ error: "Wideo tej lekcji jest chwilowo niedostępne." }, { status: 502 });
        if (server) {
          // Ochrona włączona i adres /v/… → link z podpisem i terminem (skrypt na serwerze wpuszcza tylko taki).
          const signed = await signServerVideo(base44, server).catch(() => null);
          external = signed ? { url: signed.url, server: true, expires_in: signed.expires_in } : { url: server, server: true };
        } else external = { embed: embed.embed, provider: embed.provider };
      }
      const ip = clientIp(req);
      const blocked = await checkVideoAbuse(base44, email, ip);
      if (blocked) return Response.json({ error: blocked }, { status: 429 });
      // Jedno odtwarzanie naraz: nowa sesja przejmuje konto.
      const sid = String(body.session_id || "").slice(0, 64);
      const st = (await sr.ActiveStream.filter({ user_email: email }))[0];
      if (st) await sr.ActiveStream.update(st.id, { session_id: sid, lesson_id: lesson.id });
      else await sr.ActiveStream.create({ user_email: email, session_id: sid, lesson_id: lesson.id });
      await sr.PlaybackLog.create({
        user_email: email, product_id: pid, lesson_id: lesson.id, lesson_title: lesson.title,
        ip, user_agent: (req.headers.get("user-agent") || "").slice(0, 300),
      });
      if (external) return Response.json({ ...external, license: a.id.slice(-8).toUpperCase() });
      const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
        file_uri: lesson.video_uri, expires_in: 3600,
      });
      return Response.json({ url: signed_url, license: a.id.slice(-8).toUpperCase() });
    }

    if (body.action === "violation") {
      await sr.SecurityLog.create({ type: "znak_wodny", user_email: email, ip: clientIp(req), details: `Lekcja: ${lesson.title}` });
      return Response.json({ ok: true });
    }

    if (body.action === "progress") {
      const st = (await sr.ActiveStream.filter({ user_email: email }))[0];
      if (st && body.session_id && st.session_id !== body.session_id) {
        return Response.json({ stopped: true });
      }
      const data = {
        position_s: Math.max(0, Math.round(Number(body.position_s) || 0)),
        ...(body.completed ? { completed: true } : {}),
      };
      const ex = (await sr.LessonProgress.filter({ user_email: email, lesson_id: lesson.id }))[0];
      if (ex) await sr.LessonProgress.update(ex.id, data);
      else await sr.LessonProgress.create({ user_email: email, product_id: pid, lesson_id: lesson.id, ...data });
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
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
