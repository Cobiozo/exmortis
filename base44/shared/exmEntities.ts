// Minimalny klient encji na tabelach exm_* w Supabase (dane produkcyjne strony), dla funkcji Base44,
// które muszą pisać do tych samych danych co strona. Obsługuje tylko list / create / update —
// tyle, ile potrzebuje import podcastu z RSS (podcastRss.ts).
import { runSql, escStr } from "./supabase.ts";

const BUILT = new Set(["created_date", "updated_date"]);
const row2rec = (r) => ({ ...(r.data || {}), id: r.id, created_date: r.created_date, updated_date: r.updated_date });

function entity(base44, name: string) {
  const t = `public.exm_${name.toLowerCase()}`;
  return {
    async list(sort = "-created_date", limit = 100) {
      const desc = String(sort || "").startsWith("-");
      const f = String(sort || "created_date").replace(/^-/, "");
      const col = BUILT.has(f) ? f : `data->>${escStr(f)}`;
      const n = Math.max(1, Math.min(Number(limit) || 100, 1000));
      const rows = await runSql(base44, `SELECT id, data, created_date, updated_date FROM ${t} ORDER BY ${col} ${desc ? "DESC" : "ASC"} NULLS LAST LIMIT ${n}`, true);
      return (rows || []).map(row2rec);
    },
    async create(rec) {
      const id = crypto.randomUUID();
      const data = { ...rec };
      delete data.id;
      await runSql(base44, `INSERT INTO ${t} (id, data, created_date, updated_date) VALUES (${escStr(id)}, ${escStr(JSON.stringify(data))}::jsonb, now(), now())`);
      return { ...data, id };
    },
    async update(id, patch) {
      const p = { ...patch };
      delete p.id;
      await runSql(base44, `UPDATE ${t} SET data = data || ${escStr(JSON.stringify(p))}::jsonb, updated_date = now() WHERE id = ${escStr(String(id))}`);
      return { id, ...p };
    },
  };
}

export function exmClient(base44) {
  return {
    entities: new Proxy({}, { get: (_t, name) => entity(base44, String(name)) }),
  };
}
