import { createClientFromRequest } from "../_shared/compat.ts";
import { waitUntil } from "../_shared/shim.ts";
import { runSql, esc, textField, emailField, clientIp } from "../_shared/supabase.ts";
import { isUrgent, notifyUrgent } from "../_shared/crisis.ts";
import { errorResponse } from "../_shared/errors.ts";

const LIMIT_PER_HOUR = 5;

// Znacznik „pilne" na wiadomości; kolumna zakładana raz na instancję.
let PILNE_COL = false;
async function ensurePilne(base44) {
  if (PILNE_COL) return;
  const has = await runSql(base44, `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contact_messages' AND column_name = 'pilne'`, true);
  if (!(Array.isArray(has) && has.length)) await runSql(base44, `ALTER TABLE public.contact_messages ADD COLUMN IF NOT EXISTS pilne boolean`);
  PILNE_COL = true;
}

const handler = async function (req) {
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
    // Błąd walidacji = komunikat dla formularza; reszta (baza, połączanie) = generyczna odpowiedź.
    return errorResponse(error, "Nie udało się wysłać wiadomości. Spróbuj ponownie za chwilę.");
  }
}

// === Supabase Edge (wygenerowane przez docs/tech/migruj.mjs) ===
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const res = await handler(req);
    const h = new Headers(res.headers);
    for (const [k, v] of Object.entries(CORS)) h.set(k, v);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  } catch (e) {
    const msg = String(e?.message || e);
    const status = msg === "FORBIDDEN" ? 403 : e && e.isValidation ? 400 : 500;
    console.error("edge:", msg.slice(0, 300));
    return Response.json({ error: msg.slice(0, 300) }, { status, headers: CORS });
  }
});
