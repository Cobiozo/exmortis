// Wspólna baza PGlite dla testów (Postgres w pamięci). runSql = jak exm_exec_sql: wiersze dla SELECT i DML z RETURNING.
import { PGlite } from "@electric-sql/pglite";
export const db = globalThis.__db || (globalThis.__db = new PGlite());
export const sqlLog = globalThis.__sqlLog || (globalThis.__sqlLog = []);
export async function runSql(_b, query, _ro = false) {
  const q = String(query || "").trim().replace(/;+\s*$/, "");
  sqlLog.push(q);
  if (globalThis.__failSql && globalThis.__failSql(q)) throw new Error("SYMULOWANY BŁĄD BAZY");
  const r = await db.query(q);
  return r.rows || [];
}
