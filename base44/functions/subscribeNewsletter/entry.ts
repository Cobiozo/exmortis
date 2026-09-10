import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, escStr, emailField } from "../../shared/supabase.ts";

// Publiczne zapisy do newslettera „Listy powrotu".
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const email = emailField(body);
    const name = body.name === undefined || body.name === null || String(body.name).trim() === ""
      ? "NULL"
      : escStr(String(body.name).trim().slice(0, 200));

    await runSql(
      base44,
      `INSERT INTO public.subscribers (id, email, name)
       VALUES (gen_random_uuid()::text, ${escStr(email)}, ${name})
       ON CONFLICT (email) DO NOTHING`
    );
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}