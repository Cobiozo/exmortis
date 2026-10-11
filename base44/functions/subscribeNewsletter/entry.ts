import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { emailField, clientIp } from "../../shared/supabase.ts";
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
      const ip = clientIp(req);
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
    // Błąd walidacji formularza = 400 (wina danych), reszta = 500.
    const bad = /^(Brak pola|Pole .* jest zbyt długie|Niepoprawny adres e-mail)/.test(String(error?.message || ""));
    return Response.json({ error: error.message }, { status: bad ? 400 : 500 });
  }
}