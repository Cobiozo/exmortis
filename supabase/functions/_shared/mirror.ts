// Lustrzany zapis rekordów Base44 do tabel exm_* w Supabase — etap przejściowy migracji.
// Base44 pozostaje na razie źródłem prawdy (odczyty idą z Base44); kopia w Supabase przygotowuje
// przełączenie odczytów, nic więc nie ginie między krokami. Awaria lustra NIE przerywa
// operacji aplikacji — ślad zostaje w logach serwera i kopia jest dopełniana przy następnej zmianie.
import { runSql, escStr, restGet } from "./supabase.ts";

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

// ==== ODCZYT Z KOPII (Supabase jako pierwsze źródło, Base44 awaryjnie) ====

const enc = encodeURIComponent;

// Proste warunki: równość, null, $in, $ne, $regex (kotwica $ = koniec tekstu).
function cond(field, c) {
  const col = field === "id" ? "id" : `data->>${enc(field)}`;
  if (c === null) return `${col}=is.null`;
  if (typeof c === "object" && !Array.isArray(c)) {
    const [op, v] = Object.entries(c)[0];
    if (op === "$in") return `${col}=in.(${(Array.isArray(v) ? v : [v]).map((x) => `"${x}"`).join(",")})`;
    if (op === "$ne") return `${col}=neq.${enc(String(v))}`;
    if (op === "$regex") {
      // Zgody zapisują adresy z różną wielkością liter — wyszukiwanie po adresie bez rozróżniania liter.
      const nocase = String(c.$options || "").includes("i");
      const like = nocase ? "ilike" : "like";
      const p = String(v);
      if (p.startsWith("^") && p.endsWith("$")) return `${col}=${like}.${enc(p.slice(1, -1))}`;
      return `${col}=${like}.*${enc(p.replace(/\$$/, ""))}`;
    }
    throw new Error(`Nieobsługiwany operator kopii: ${op}`);
  }
  return `${col}=eq.${enc(String(c))}`;
}

function qs(query, sort, limit) {
  const parts = [];
  for (const [f, c] of Object.entries(query || {})) parts.push(cond(f, c));
  if (sort) {
    const dir = String(sort).startsWith("-") ? "desc" : "asc";
    const field = String(sort).replace(/^-/, "");
    const built = ["created_date", "updated_date"].includes(field);
    parts.push(`order=${built ? field : enc("data->>" + field)}.${dir}`);
  }
  if (limit) parts.push(`limit=${limit}`);
  return parts.join("&");
}

const row2rec = (r) => ({ ...(r.data || {}), id: r.id, created_date: r.created_date, updated_date: r.updated_date, created_by_id: r.created_by_id });

// Odczyt z kopii — rzuca błąd, gdy Supabase nie odpowiada (wywołujący ma awaryjny odczyt z Base44).
export async function mirrorFilter(base44, entity, query = {}, sort, limit) {
  const rows = await restGet(base44, `exm_${entity.toLowerCase()}?${qs(query, sort, limit)}`);
  return rows.map(row2rec);
}

export async function mirrorGet(base44, entity, id) {
  const rows = await restGet(base44, `exm_${entity.toLowerCase()}?id=eq.${enc(String(id))}&limit=1`);
  return rows[0] ? row2rec(rows[0]) : null;
}

// Dostęp do produktu: najpierw kopia, w razie problemu Base44.
export async function accessFilter(base44, query = {}, sort, limit) {
  try {
    return await mirrorFilter(base44, "Access", query, sort, limit);
  } catch (e) {
    console.error("odczyt:Access:", String(e?.message || e).slice(0, 200));
    return base44.asServiceRole.entities.Access.filter(query, sort, limit);
  }
}

// Zgody (Consent): najpierw kopia, w razie problemu Base44.
export async function consentFilter(base44, query = {}, sort, limit) {
  try {
    return await mirrorFilter(base44, "Consent", query, sort, limit);
  } catch (e) {
    console.error("odczyt:Consent:", String(e?.message || e).slice(0, 200));
    return base44.asServiceRole.entities.Consent.filter(query, sort, limit);
  }
}

export async function accessGet(base44, id) {
  try {
    const r = await mirrorGet(base44, "Access", id);
    if (r) return r;
  } catch (e) {
    console.error("odczyt:Access:", String(e?.message || e).slice(0, 200));
  }
  return base44.asServiceRole.entities.Access.get(id);
}