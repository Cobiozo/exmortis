import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, esc, textField, emailField } from "../../shared/supabase.ts";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const fullName = textField(body, "full_name", { max: 200 });
    const phone = textField(body, "phone", { max: 50 });
    const email = emailField(body);
    const motivation = textField(body, "motivation", { max: 5000 });
    const story = textField(body, "story", { max: 8000 });

    const rows = await runSql(
      base44,
      `INSERT INTO public.podcast_applications
         (id, full_name, phone, email, motivation, story, created_date, updated_date)
       VALUES
         (gen_random_uuid()::text, ${esc(fullName)}, ${esc(phone)}, ${esc(email)},
          ${esc(motivation)}, ${esc(story)}, now(), now())
       RETURNING id`
    );

    return Response.json({ ok: true, id: rows && rows[0] ? rows[0].id : null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}