import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { waitUntil } from "base44:runtime";
import { runSql, esc, textField, emailField, clientIp } from "../../shared/supabase.ts";
import { isUrgent, notifyUrgent } from "../../shared/crisis.ts";

const LIMIT_PER_HOUR = 5;

// Znacznik „pilne" na wiadomości; kolumna zakładana raz na instancję.
let PILNE_COL = false;
async function ensurePilne(base44) {
  if (PILNE_COL) return;
  const has = await runSql(base44, `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contact_messages' AND column_name = 'pilne'`, true);
  if (!(Array.isArray(has) && has.length)) await runSql(base44, `ALTER TABLE public.contact_messages ADD COLUMN IF NOT EXISTS pilne boolean`);
  PILNE_COL = true;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Pole-pułapka: ludzie go nie widzą, boty je wypełniają. Udajemy sukces.
    if (body.website) return Response.json({ ok: true, id: null });

    const name = textField(body, "name", { max: 200 });
    const email = emailField(body);
    const message = textField(body, "message", { max: 10000 });
    const pilne = isUrgent(message);
    const realIp = clientIp(req);
    const ip = realIp === "brak" ? null : realIp;

    if (ip) {
      const rows = await runSql(base44, `SELECT count(*)::int AS n FROM public.contact_messages WHERE ip = ${esc(ip)} AND created_date > now() - interval '1 hour'`, true);
      if ((rows?.[0]?.n || 0) >= LIMIT_PER_HOUR) {
        return Response.json({ error: "Wysłano już kilka wiadomości. Spróbuj ponownie za godzinę." }, { status: 429 });
      }
    }

    await ensurePilne(base44);
    const rows = await runSql(
      base44,
      `INSERT INTO public.contact_messages
         (id, name, email, message, ip, pilne, created_date, updated_date)
       VALUES
         (gen_random_uuid()::text, ${esc(name)}, ${esc(email)}, ${esc(message)}, ${esc(ip)}, ${esc(pilne)}, now(), now())
       RETURNING id`
    );

    if (pilne) waitUntil(notifyUrgent(base44));

    return Response.json({ ok: true, id: rows && rows[0] ? rows[0].id : null, pilne });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}