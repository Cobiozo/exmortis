export { runSql } from "./db.mjs";
export function escStr(value) {
  const s = String(value); let d = "$q$";
  for (let n = 1; (s + d).indexOf(d) !== s.length; n++) d = `$q${n}$`;
  return `${d}${s}${d}`;
}
export function esc(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return escStr(value);
}
export async function rpc() { throw new Error("rpc niedostępne w teście"); }
export async function restGet() { return []; }
export async function restCount() { return 0; }
