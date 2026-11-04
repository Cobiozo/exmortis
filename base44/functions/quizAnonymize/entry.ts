import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql } from "../../shared/supabase.ts";

// Jednorazowe czyszczenie (decyzja właściciela 5.11.2026): w starszych wierszach public.quiz_result
// usuwamy imię, e-mail, formę zwracania się i zdanie refleksji. Sumy punktów, kategoria, etap i data
// zostają do upływu dotychczasowego okresu przechowywania (12 mies.). Operacja jest idempotentna
// i wyłącznie zmniejsza zakres danych — nie przyjmuje parametrów i nie zwraca żadnych danych osób,
// tylko liczby. Po użyciu funkcja zostaje wyłączona (410).
const PII = ["email", "first_name", "form_of_address", "open_answer"];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const cols = await runSql(base44, `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'quiz_result'`, true);
    const have = new Set((cols || []).map((c) => c.column_name));
    const target = PII.filter((c) => have.has(c));
    if (!target.length) return Response.json({ ok: true, columns: [], before: 0, cleared: 0 });
    for (const c of target) await runSql(base44, `ALTER TABLE public.quiz_result ALTER COLUMN ${c} DROP NOT NULL`);
    const anyPii = target.map((c) => `${c} IS NOT NULL`).join(" OR ");
    const before = await runSql(base44, `SELECT COUNT(*)::int AS n FROM public.quiz_result WHERE ${anyPii}`, true);
    const set = target.map((c) => `${c} = NULL`).join(", ") + (have.has("anon") ? ", anon = true" : "");
    const done = await runSql(base44, `UPDATE public.quiz_result SET ${set} WHERE ${anyPii} RETURNING 1`);
    const after = await runSql(base44, `SELECT COUNT(*)::int AS n FROM public.quiz_result WHERE ${anyPii}`, true);
    const total = await runSql(base44, `SELECT COUNT(*)::int AS n FROM public.quiz_result`, true);
    return Response.json({ ok: true, columns: target, before: before?.[0]?.n ?? null, cleared: done?.length ?? 0, left: after?.[0]?.n ?? null, total: total?.[0]?.n ?? null });
  } catch (e) {
    return Response.json({ error: String(e?.message || e).slice(0, 200) }, { status: 500 });
  }
});
