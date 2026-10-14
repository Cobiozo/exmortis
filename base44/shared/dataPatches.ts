// Jednorazowe poprawki danych zapisane w kodzie (historia zmian w repozytorium zamiast ręcznych zmian w bazie).
// Wykonuje je zadanie cykliczne cmsScheduled; każda poprawka działa raz (lista wykonanych w app_settings „data_patches”).
// Każda jest bezpieczna do powtórzenia, gdyby dwa wywołania zbiegły się w czasie.
import { runSql } from "./supabase.ts";
import { getSetting, saveSetting } from "./settings.ts";
import { clearSnap } from "./snapshot.ts";
import { ensureWaitlistCols } from "./waitlist.ts";

const PATCHES: { id: string; why: string; sql: string[] }[] = [
  {
    id: "2026-10-14-wracam-inny",
    why: "„Wracam inny”: cena regularna 97 zł, drabinka 47 zł do 22.11 i 77 zł do 6.12, „wkrótce”, premiera (przedsprzedaż) 16.11 o 6:00",
    sql: [
      `UPDATE public.products SET price = 97, price_regular = 97, price_start = NULL, promo_end_date = NULL, old_price = NULL,
         status = 'wkrótce', available_at = NULL,
         price_steps = '[{"do":"2026-11-22","cena":47},{"do":"2026-12-06","cena":77}]'::jsonb,
         release_at = '2026-11-16T06:00:00+01:00'::timestamptz, release_notify = FALSE
       WHERE slug = 'wracam-inny'`,
    ],
  },
  {
    id: "2026-10-14-cudzyslowy",
    why: "Nazwy produktów: zamykający cudzysłów „…” zamiast apostrofu lub prostego cudzysłowu",
    sql: [
      `UPDATE public.products SET name = regexp_replace(name, '„([^„”"'']*)["'']', '„\\1”', 'g') WHERE name ~ '„[^”]*["'']'`,
    ],
  },
];

export async function applyDataPatches(base44): Promise<string[]> {
  const done: string[] = (await getSetting(base44, "data_patches").catch(() => null)) || [];
  const todo = PATCHES.filter((p) => !done.includes(p.id));
  if (!todo.length) return [];
  await ensureWaitlistCols(base44); // kolumny premiery (release_at…) muszą istnieć
  const applied: string[] = [];
  for (const p of todo) {
    try {
      for (const q of p.sql) await runSql(base44, q);
      applied.push(p.id);
      console.log(`[poprawka danych] ${p.id}: ${p.why}`);
    } catch (e) {
      console.error(`[poprawka danych] ${p.id} nie powiodła się:`, e?.message);
    }
  }
  if (applied.length) {
    await saveSetting(base44, "data_patches", [...done, ...applied]);
    await clearSnap(base44, "products:").catch(() => {});
  }
  return applied;
}
