import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { emailField } from "../../shared/supabase.ts";
import { addSubscriber, confirmSubscriber } from "../../shared/newsletter.ts";
import { LISTY_TEXT } from "../../shared/registrations.ts";

// Publiczne zapisy do newslettera „Listy powrotu" + potwierdzenie z linku (double opt-in).
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    if (body.action === "confirm") {
      const row = await confirmSubscriber(base44, String(body.token || ""));
      if (!row) return Response.json({ ok: false });
      const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim().slice(0, 64) || "brak";
      await base44.asServiceRole.entities.Consent.create({
        email: row.email, kind: "newsletter", text: `${LISTY_TEXT} (potwierdzone kliknięciem linku z e-maila)`,
        source: "listy:potwierdzenie", given_at: new Date(row.confirmed_at).toISOString(), ip, status: "udzielona", doc_version: "1.1",
      });
      return Response.json({ ok: true });
    }
    const email = emailField(body);
    await addSubscriber(base44, { email, name: body.name });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}