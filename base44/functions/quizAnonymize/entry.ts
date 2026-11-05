import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, listAuthUsers } from "../../shared/supabase.ts";

// Jednorazowa diagnostyka (5.11.2026): czy konto testowe właściciela jest w logowaniu i ma profil.
// Bez parametrów; zwraca wyłącznie liczby i wartości tak/nie. Po użyciu wyłączane.
const TEST = "dawidkowalczyk.king+test123@gmail.com";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const users = await listAuthUsers(base44);
    const u = users.find((x) => String(x.email || "").toLowerCase() === TEST);
    const prof = await runSql(base44, `SELECT count(*)::int AS n FROM public.exm_user WHERE lower(data->>'email') = '${TEST}'`, true);
    const profTotal = await runSql(base44, `SELECT count(*)::int AS n FROM public.exm_user`, true);
    return Response.json({
      auth_total: users.length, test_in_auth: !!u, test_confirmed: !!u?.email_confirmed_at,
      test_profile: (prof?.[0]?.n || 0) > 0, profiles_total: profTotal?.[0]?.n ?? null,
    });
  } catch (e) {
    return Response.json({ error: String(e?.message || e).slice(0, 200) }, { status: 500 });
  }
});
