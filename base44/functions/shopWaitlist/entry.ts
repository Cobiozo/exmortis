import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, escStr, emailField, textField } from "../../shared/supabase.ts";

// Publiczny zapis na listę oczekujących przy produkcie "wkrótce".
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const email = emailField(body);
    const firstName = textField(body, "first_name", { max: 200, required: false });
    const productId = textField(body, "product_id", { max: 100 });

    await runSql(
      base44,
      `INSERT INTO public.waitlist (email, first_name, product_id)
       VALUES (${escStr(email)}, ${firstName === null ? "NULL" : escStr(firstName)}, ${escStr(productId)})
       ON CONFLICT (email, product_id) DO NOTHING`
    );
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}