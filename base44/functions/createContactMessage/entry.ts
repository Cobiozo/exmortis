import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, esc, textField, emailField } from "../../shared/supabase.ts";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const name = textField(body, "name", { max: 200 });
    const email = emailField(body);
    const message = textField(body, "message", { max: 10000 });

    const rows = await runSql(
      base44,
      `INSERT INTO public.contact_messages
         (id, name, email, message, created_date, updated_date)
       VALUES
         (gen_random_uuid()::text, ${esc(name)}, ${esc(email)}, ${esc(message)}, now(), now())
       RETURNING id`
    );

    return Response.json({ ok: true, id: rows && rows[0] ? rows[0].id : null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}