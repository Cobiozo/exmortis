import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql } from "../../shared/supabase.ts";

// Jednorazowe czyszczenie (decyzja właściciela 5.11.2026).
// Krok 1 (wykonany wcześniej tego dnia): quiz_result — usunięte imię, e-mail, forma zwracania się, zdanie (16 z 27 wierszy).
// Krok 2: treść maili z wynikiem testu, które nie wyszły (kind „test”, status „blad”) — html, załączniki
// i temat usunięte, status „pominiety” (nigdy nie zostaną wysłane). Idempotentne, bez parametrów,
// zwraca tylko liczby. Po użyciu funkcja zostaje wyłączona.
const MSG = "Treść usunięta 5.11.2026 — test działa tylko w przeglądarce";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const t = await runSql(base44, `SELECT to_regclass('public.exm_mailqueue') IS NOT NULL AS ok`, true);
    if (!t?.[0]?.ok) return Response.json({ error: "Brak tabeli kolejki" }, { status: 500 });
    const where = `data->>'kind' = 'test' AND data->>'status' = 'blad'`;
    const before = await runSql(base44, `SELECT COUNT(*)::int AS n FROM public.exm_mailqueue WHERE ${where}`, true);
    const done = await runSql(base44, `UPDATE public.exm_mailqueue
      SET data = data || jsonb_build_object('html', '', 'attachments', '[]'::jsonb, 'subject', '(treść usunięta)',
        'status', 'pominiety', 'blad', '${MSG}'), updated_date = now()
      WHERE ${where} RETURNING 1`);
    const leftHtml = await runSql(base44, `SELECT COUNT(*)::int AS n FROM public.exm_mailqueue
      WHERE data->>'kind' IN ('test', 'test_wynik') AND data->>'status' <> 'wyslany' AND COALESCE(data->>'html', '') <> ''`, true);
    return Response.json({ ok: true, before: before?.[0]?.n ?? null, cleared: done?.length ?? 0, unsent_with_html_left: leftHtml?.[0]?.n ?? null });
  } catch (e) {
    return Response.json({ error: String(e?.message || e).slice(0, 200) }, { status: 500 });
  }
});
