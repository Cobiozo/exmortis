import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { isActive } from "../../shared/access.ts";
import { checkVideoAbuse } from "../../shared/videoGuard.ts";

// Kurs klienta: spis lekcji, podpisany link do wideo (po sprawdzeniu dostępu), postęp.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me) return Response.json({ error: "Zaloguj się" }, { status: 401 });
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
          duration_min: l.duration_min || null, has_video: !!l.video_uri,
          position_s: byL.get(l.id)?.position_s || 0, completed: !!byL.get(l.id)?.completed,
        })),
      });
    }

    const lesson = await sr.CourseLesson.get(String(body.lesson_id || "")).catch(() => null);
    if (!lesson || lesson.product_id !== pid || lesson.published === false) {
      return Response.json({ error: "Nie ma takiej lekcji" }, { status: 404 });
    }

    if (body.action === "play") {
      if (!lesson.video_uri) return Response.json({ error: "Wideo jest przygotowywane" }, { status: 404 });
      const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
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
      const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
        file_uri: lesson.video_uri, expires_in: 3600,
      });
      return Response.json({ url: signed_url, license: a.id.slice(-8).toUpperCase() });
    }

    if (body.action === "violation") {
      await sr.SecurityLog.create({ type: "znak_wodny", user_email: email, ip: (req.headers.get("x-forwarded-for") || "").split(",")[0].trim(), details: `Lekcja: ${lesson.title}` });
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