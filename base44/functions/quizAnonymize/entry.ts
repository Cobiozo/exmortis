// Jednorazowe zadania (decyzje właściciela):
// 5.11.2026 — quiz_result: usunięte imię, e-mail, forma zwracania się i zdanie refleksji (16 z 27 wierszy);
//             kolejka poczty: treść 7 niewysłanych maili z wynikiem testu usunięta, status „pominiety”;
//             Biblioteka: reguła grup „wszystkie_konta” i grupa „Wszystkie konta” (Obok → Biblioteka);
//             anonimowy licznik ukończeń testu (base44/shared/testCountSql.ts).
// 5.11.2026 (audyt) — reguła „wszystkie_konta” tylko dla potwierdzonych adresów: podmiana samej funkcji
//             mb_auto_group_emails z librarySchema.ts. Zwraca wyłącznie liczby. Po wykonaniu funkcja wraca do 410.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql } from "../../shared/supabase.ts";
import { SCHEMA_SQL } from "../../shared/librarySchema.ts";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const start = SCHEMA_SQL.indexOf("CREATE OR REPLACE FUNCTION public.mb_auto_group_emails");
    const end = SCHEMA_SQL.indexOf("END $ae$;", start);
    if (start < 0 || end < 0) return Response.json({ error: "Brak definicji funkcji" }, { status: 500 });
    const fn = SCHEMA_SQL.slice(start, end + "END $ae$;".length);
    if (!fn.includes("email_confirmed_at IS NOT NULL")) return Response.json({ error: "Stara definicja" }, { status: 500 });
    await runSql(base44, fn);
    await runSql(base44, "REVOKE ALL ON FUNCTION public.mb_auto_group_emails(jsonb) FROM PUBLIC, anon, authenticated;");
    const check = await runSql(base44, `SELECT
      (SELECT count(*) FROM public.mb_auto_group_emails('{"typ":"wszystkie_konta"}'::jsonb)) AS w_grupie,
      (SELECT count(*) FROM auth.users WHERE email IS NOT NULL AND deleted_at IS NULL) AS wszystkie_konta,
      (SELECT count(*) FROM auth.users WHERE email IS NOT NULL AND deleted_at IS NULL AND email_confirmed_at IS NULL) AS niepotwierdzone,
      position('email_confirmed_at' in pg_get_functiondef('public.mb_auto_group_emails(jsonb)'::regprocedure)) > 0 AS nowa_definicja,
      has_function_privilege('anon', 'public.mb_auto_group_emails(jsonb)', 'EXECUTE') AS anon_moze`, true);
    return Response.json({ ok: true, check });
  } catch (error) {
    return Response.json({ error: String(error?.message || error).slice(0, 300) }, { status: 500 });
  }
});
