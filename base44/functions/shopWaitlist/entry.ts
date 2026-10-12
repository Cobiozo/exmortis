import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, escStr, emailField, textField, clientIp } from "../../shared/supabase.ts";
import { ipAllowed, TOO_MANY } from "../../shared/rateLimit.ts";

// Publiczny zapis na listę oczekujących przy produkcie "wkrótce" (limit 10 zapisów na godzinę z jednego IP).
// Powiadomienie o premierze wysyła administrator: Panel → Skarbiec → „Lista oczekujących”.
export default async function (req) {
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
