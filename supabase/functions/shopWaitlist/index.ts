import { createClientFromRequest } from "../_shared/compat.ts";
import { runSql, escStr, emailField, textField, clientIp } from "../_shared/supabase.ts";
import { ipAllowed, TOO_MANY } from "../_shared/rateLimit.ts";

// Publiczny zapis na listę oczekujących przy produkcie "wkrótce" (limit 10 zapisów na godzinę z jednego IP).
// Powiadomienie o premierze wysyła administrator: Panel → Skarbiec → „Lista oczekujących”.
const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    let email, firstName, productId;
    try {
      email = emailField(body);
      firstName = textField(body, "first_name", { max: 200, required: false });
      productId = textField(body, "product_id", { max: 100 });
    } catch (e) {
      return Response.json({ error: e.message }, { status: 400 });
    }
    if (!(await ipAllowed(base44, clientIp(req), "lista", 10, 3600000, productId))) return Response.json({ error: TOO_MANY }, { status: 429 });

    await runSql(
      base44,
      `INSERT INTO public.waitlist (email, first_name, product_id)
       SELECT ${escStr(email)}, ${firstName === null ? "NULL" : escStr(firstName)}, ${escStr(productId)}
       WHERE EXISTS (SELECT 1 FROM public.products WHERE id::text = ${escStr(productId)} AND active = TRUE)
       ON CONFLICT (email, product_id) DO NOTHING`
    );
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
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
