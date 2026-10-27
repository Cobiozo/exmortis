// Funkcja kontrolna: sprawdza, czy wdrożona funkcja startuje i czy potrafi wykonać zapytanie do bazy.
// Do usunięcia po weryfikacji wdrożenia.
import { runSql } from "../_shared/supabase.ts";

Deno.serve(async () => {
  try {
    const rows = await runSql(null, "select 1 as ok");
    return Response.json({ ok: true, rows });
  } catch (e) {
    return Response.json({ ok: false, error: String((e && (e as Error).message) || e).slice(0, 300) }, { status: 500 });
  }
});