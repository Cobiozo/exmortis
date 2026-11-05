// Jednorazowe zadania (decyzje właściciela):
// 5.11.2026 — quiz_result: usunięte imię, e-mail, forma zwracania się i zdanie refleksji (16 z 27 wierszy);
//             kolejka poczty: treść 7 niewysłanych maili z wynikiem testu usunięta, status „pominiety”;
//             Biblioteka: reguła grup „wszystkie_konta” i grupa „Wszystkie konta” (Obok → Biblioteka).
// 5.11.2026 — anonimowy licznik ukończeń testu: tabela test_counts + funkcje test_done / test_stats.
// Wywołanie tworzy (idempotentnie) licznik i zwraca kontrolę; po wykonaniu funkcja wraca do 410.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql } from "../../shared/supabase.ts";
import { TEST_COUNT_SQL } from "../../shared/testCountSql.ts";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    await runSql(base44, TEST_COUNT_SQL);
    const check = await runSql(base44, `SELECT
      (SELECT count(*) FROM pg_proc WHERE proname IN ('test_done','test_stats') AND pronamespace = 'public'::regnamespace) AS funkcje,
      (SELECT count(*) FROM public.test_counts) AS wiersze,
      (SELECT count(*) FROM public.exm_user WHERE data->>'role' = 'admin') AS administratorzy,
      has_function_privilege('anon', 'public.test_done(text)', 'EXECUTE') AS anon_test_done,
      has_function_privilege('anon', 'public.test_stats()', 'EXECUTE') AS anon_test_stats,
      has_table_privilege('anon', 'public.test_counts', 'SELECT') AS anon_czyta_tabele`, true);
    return Response.json({ ok: true, check });
  } catch (error) {
    return Response.json({ error: String(error?.message || error).slice(0, 300) }, { status: 500 });
  }
});
