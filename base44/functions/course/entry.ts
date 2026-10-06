import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { isActive } from "../../shared/access.ts";

const MAX_IPS_24H = 4;

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
      const since = new Date(Date.now() - 86400000).toISOString();
      const recent = await sr.PlaybackLog.filter({ user_email: email, created_date: { $gte: since } }, "-created_date", 200);
      const ips = new Set(recent.map((r) => r.ip).filter(Boolean));
      if (ip && !ips.has(ip) && ips.size >= MAX_IPS_24H) {
        return Response.json({ error: "Konto jest używane w zbyt wielu miejscach naraz. Spróbuj jutro albo napisz do mnie." }, { status: 429 });
      }
      await sr.PlaybackLog.create({
        user_email: email, product_id: pid, lesson_id: lesson.id, lesson_title: lesson.title,
        ip, user_agent: (req.headers.get("user-agent") || "").slice(0, 300),
      });
      const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
        file_uri: lesson.video_uri, expires_in: 3 * 3600,
      });
      return Response.json({ url: signed_url });
    }

    if (body.action === "progress") {
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