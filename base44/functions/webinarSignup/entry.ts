import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, escStr, textField, emailField } from "../../shared/supabase.ts";
import { addSubscriber } from "../../shared/newsletter.ts";

// Publiczne zapisy na webinar 1 listopada („Ze śmierci").
// Mailing do grup „Webinar 1.11" / „Listy powrotu" zostanie podpięty później —
// na razie zapisy lądują w tabeli public.webinar_1_11 z oznaczeniem grup.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const name = textField(body, "name", { max: 200 });
    const email = emailField(body);
    const listy = body.listy === true;
    const source = textField(body, "source", { max: 200, required: false }) || null;

    await runSql(
      base44,
      `CREATE TABLE IF NOT EXISTS public.webinar_1_11 (
         id text PRIMARY KEY,
         email text UNIQUE NOT NULL,
         name text,
         source text,
         listy boolean DEFAULT FALSE,
         created_at timestamptz DEFAULT now()
       )`
    );

    const inserted = await runSql(
      base44,
      `INSERT INTO public.webinar_1_11 (id, email, name, source, listy)
       VALUES (gen_random_uuid()::text, ${escStr(email)}, ${escStr(name)}, ${
        source ? escStr(source) : "NULL"
      }, ${listy})
       ON CONFLICT (email) DO NOTHING
       RETURNING id`
    );

    // Drugi checkbox → zapis w istniejącej liście „Listy powrotu".
    if (listy) {
      await addSubscriber(base44, { email, name, consentGiven: true });
    }

    return Response.json({ ok: true, duplicate: (inserted || []).length === 0 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}