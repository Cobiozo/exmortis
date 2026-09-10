import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { requireAdmin, emailField } from "../../shared/supabase.ts";
import { getSetting } from "../../shared/settings.ts";
import { sendMail } from "../../shared/smtp.ts";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    await requireAdmin(base44);
    const body = await req.json().catch(() => ({}));
    const to = emailField(body, "to");

    const smtp = await getSetting(base44, "smtp");
    await sendMail(smtp, {
      to,
      subject: "EXMORTIS — test SMTP",
      html: `
      <div style="background:#0A0A0B;padding:32px;font-family:Georgia,serif;color:#E2E2E2;">
        <p style="letter-spacing:4px;color:#C9A24A;font-size:13px;">EXMORTIS</p>
        <h1 style="font-size:22px;">Połączenie SMTP działa</h1>
        <p style="color:#8A8A8C;line-height:1.7;">Ten list przeszedł przez Twoją skrzynkę.
        Newsletter i potwierdzenia zamówień będą docierały tym samym kanałem.</p>
      </div>`,
    });
    return Response.json({ ok: true });
  } catch (error) {
    if (error && error.message === "FORBIDDEN") {
      return Response.json({ error: "Brak dostępu" }, { status: 403 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
}