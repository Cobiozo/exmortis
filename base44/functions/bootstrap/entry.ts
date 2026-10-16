import { createClientFromRequest } from "npm:@base44/sdk@0.8.53";
import { publicSettings, publicContent, publicEvent } from "../../shared/publicData.ts";

// Jedno wywołanie startowe gościa: ustawienia + treści + strona z edytora + spotkanie.
// { ping: true } — rozgrzewanie, bez odczytów i zapisów.
const SLUG = /^[a-z0-9-]{1,100}$/;

export default async function (req) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body.ping) return Response.json({ ok: true });
    const base44 = createClientFromRequest(req);
    const page = SLUG.test(String(body.page || "")) ? body.page : null;
    const event = SLUG.test(String(body.event || "")) ? body.event : null;
    const part = (p) => p.catch((e) => { console.error("bootstrap", e.message); return undefined; });
    const [settings, content, pages, ev] = await Promise.all([
      part(publicSettings(base44, req)),
      part(publicContent(base44)),
      page ? part(base44.asServiceRole.entities.PublishedPage.filter({ slug: page }, "-created_date", 1)) : null,
      event ? part(publicEvent(base44, event)) : null,
    ]);
    return Response.json({ settings, content, page: pages ? pages[0] || null : undefined, event: ev });
  } catch (error) {
    console.error("bootstrap", error?.message);
    return Response.json({ error: "Chwilowy problem z danymi strony. Odśwież za chwilę." }, { status: 500 });
  }
}