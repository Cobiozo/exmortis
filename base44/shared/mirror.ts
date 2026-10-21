// Lustrzany zapis rekordów Base44 do tabel exm_* w Supabase — etap przejściowy migracji.
// Base44 pozostaje na razie źródłem prawdy (odczyty idą z Base44); kopia w Supabase przygotowuje
// przełączenie odczytów, nic więc nie ginie między krokami. Awaria lustra NIE przerywa
// operacji aplikacji — ślad zostaje w logach serwera i kopia jest dopełniana przy następnej zmianie.
import { runSql, escStr } from "./supabase.ts";

const READY = new Set();

async function ensureMirrorTable(base44, entity) {
  if (READY.has(entity)) return;
  READY.add(entity);
  const t = `exm_${entity.toLowerCase()}`;
  await runSql(
    base44,
    `CREATE TABLE IF NOT EXISTS public.${t} (
       id text PRIMARY KEY,
       data jsonb NOT NULL DEFAULT '{}'::jsonb,
       created_date timestamptz NOT NULL DEFAULT now(),
       updated_date timestamptz NOT NULL DEFAULT now(),
       created_by_id text
     );
     CREATE INDEX IF NOT EXISTS ${t}_data_gin ON public.${t} USING gin (data jsonb_path_ops);
     CREATE INDEX IF NOT EXISTS ${t}_updated_idx ON public.${t} (updated_date);`
  ).catch(() => {});
}

// Kopiuje jeden rekord encji Base44 do exm_<encja> (pola we wnętrzu `data`, jak w replikacji).
export async function mirrorRecord(base44, entity, id) {
  if (!id) return;
  try {
    await ensureMirrorTable(base44, entity);
    const rec = await base44.asServiceRole.entities[entity].get(id);
    if (!rec) return;
    const data = { ...rec };
    delete data.id;
    delete data.created_date;
    delete data.updated_date;
    delete data.created_by_id;
    const cd = rec.created_date ? `${escStr(rec.created_date)}::timestamptz` : "now()";
    await runSql(
      base44,
      `INSERT INTO public.exm_${entity.toLowerCase()} (id, data, created_date, updated_date, created_by_id)
       VALUES (${escStr(rec.id)}, ${escStr(JSON.stringify(data))}::jsonb, ${cd}, now(),
               ${rec.created_by_id ? escStr(rec.created_by_id) : "NULL"})
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_date = now()`
    );
  } catch (e) {
    console.error(`mirror:${entity}:${id}:`, String(e?.message || e).slice(0, 200));
  }
}