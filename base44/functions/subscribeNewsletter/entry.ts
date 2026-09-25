import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { emailField } from "../../shared/supabase.ts";
import { addSubscriber } from "../../shared/newsletter.ts";

// Publiczne zapisy do newslettera „Listy powrotu".
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const email = emailField(body);
    await addSubscriber(base44, { email, name: body.name, consentGiven: false });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}