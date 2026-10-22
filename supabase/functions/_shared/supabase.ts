// Natywny dostęp do Supabase dla funkcji edge — zamiennik base44/shared/supabase.ts
// (w Base44 SQL szedł przez Management API łącznika; tu bezpośrednio do Postgres).
import pg from "npm:pg@8.13.1";

const SUPA_URL = Deno.env.get("SUPABASE_URL") || "";
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const PROJECT_REF = (SUPA_URL.replace(/^https:\/\//, "").split(".")[0]) || "fqhvxhnbeyvwubpnuzxe";

// Pula połączeń do bazy — SUPABASE_DB_URL wstrzykuje runtime edge (pooler, port 6543).
let POOL: import("npm:pg@8.13.1").Pool | null = null;
function pool() {
  if (!POOL) {
    const cs = Deno.env.get("SUPABASE_DB_URL");
    if (!cs) throw new Error("Brak zmiennej SUPABASE_DB_URL (wstrzykiwana przez runtime Supabase)");
    POOL = new pg.Pool({ connectionString: cs, max: 5, idleTimeoutMillis: 20000 });
  }
  return POOL;
}

export async function runSql(_base44: unknown, query: string, _readOnly = false) {
  const res = await pool().query(query);
  return res.rows ?? [];
}

export async function serviceKey(_base44?: unknown) {
  if (!SRK) throw new Error("Brak klucza service_role (zmiana SUPABASE_SERVICE_ROLE_KEY)");
  return SRK;
}

export async function restGet(_base44: unknown, path: string) {
  const res = await fetch(`https://${PROJECT_REF}.supabase.co/rest/v1/${path}`, {
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}` }, signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Supabase REST ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

export async function restCount(_base44: unknown, path: string) {
  const res = await fetch(`https://${PROJECT_REF}.supabase.co/rest/v1/${path}`, {
    method: "HEAD", headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, Prefer: "count=exact" }, signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Supabase REST ${res.status}`);
  const range = res.headers.get("content-range") || "/0";
  return Number(range.split("/")[1]) || 0;
}

export async function rpc(_base44: unknown, fn: string, args: unknown) {
  const res = await fetch(`https://${PROJECT_REF}.supabase.co/rest/v1/rpc/${fn}`, {
    method: "POST", headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json" },
    body: JSON.stringify(args), signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase RPC ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

// Bezpieczne opakowanie wartości w dollar-quoting (ogranicznik unikalny względem treści).
export function escStr(value: unknown) {
  const s = String(value);
  let d = "$q$";
  for (let n = 1; (s + d).indexOf(d) !== s.length; n++) d = `$q${n}$`;
  return `${d}${s}${d}`;
}

export function esc(value: unknown) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return escStr(value);
}

// IP klienta — brzeg Supabase podaje X-Forwarded-For; pierwsza wartość to klient.
export function clientIp(req: Request) {
  const ok = (v: string) => /^[0-9a-fA-F:.]{3,45}$/.test(v);
  const t = (req.headers.get("true-client-ip") || "").trim();
  if (ok(t)) return t;
  const xff = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  if (ok(xff)) return xff;
  const v = (req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "").trim();
  return ok(v) ? v : "brak";
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function textField(body: Record<string, unknown> | null, key: string, { max = 2000, required = true } = {}) {
  const v = body ? body[key] : undefined;
  if (v === undefined || v === null || String(v).trim() === "") {
    if (required) { const e = new Error(`Brak pola: ${key}`); (e as { isValidation?: boolean }).isValidation = true; throw e; }
    return null;
  }
  const s = String(v).trim();
  if (s.length > max) { const e = new Error(`Pole ${key} jest zbyt długie`); (e as { isValidation?: boolean }).isValidation = true; throw e; }
  return s;
}

export function emailField(body: Record<string, unknown> | null, key = "email") {
  const v = textField(body, key, { max: 320 });
  if (!EMAIL_RE.test(v)) { const e = new Error("Niepoprawny adres e-mail"); (e as { isValidation?: boolean }).isValidation = true; throw e; }
  return v;
}

export async function requireStaff(base44: { auth: { me: () => Promise<Record<string, unknown> | null> } }) {
  const user = await base44.auth.me().catch(() => null);
  if (!user || (user.role !== "admin" && user.role !== "techniczna")) throw new Error("FORBIDDEN");
  return user;
}

export async function requireAdmin(base44: { auth: { me: () => Promise<Record<string, unknown> | null> } }) {
  const user = await base44.auth.me().catch(() => null);
  if (!user || user.role !== "admin") throw new Error("FORBIDDEN");
  return user;
}