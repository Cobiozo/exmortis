// Wspólny dostęp do projektu Supabase (exmortis) przez Management API łącznika.

const PROJECT_REF = "fqhvxhnbeyvwubpnuzxe";
const QUERY_URL = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

// Token łącznika trzymany 5 min w pamięci instancji — bez osobnego zapytania przy każdym SQL.
let TOKEN: { v: string; at: number } | null = null;

export async function runSql(base44, query, readOnly = false) {
  if (!TOKEN || Date.now() - TOKEN.at > 300000) {
    const { accessToken } = await base44.asServiceRole.connectors.getConnection("supabase");
    TOKEN = { v: accessToken, at: Date.now() };
  }
  const accessToken = TOKEN.v;
  const res = await fetch(readOnly ? `${QUERY_URL}/read-only` : QUERY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Supabase ${res.status}: ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
}

// Bezpośrednie wywołanie funkcji bazy (PostgREST RPC) — ok. 4× szybsze niż Management API.
// Klucz service_role pobierany przez łącznik i trzymany tylko w pamięci instancji (1 h), nigdy nie zapisywany.
let SKEY: { v: string; at: number } | null = null;
export async function rpc(base44, fn, args) {
  if (!SKEY || Date.now() - SKEY.at > 3600000) {
    const { accessToken } = await base44.asServiceRole.connectors.getConnection("supabase");
    const r = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/api-keys?reveal=true`, {
      headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(8000),
    });
    const k = (await r.json()).find?.((x) => x.name === "service_role")?.api_key;
    if (!k) throw new Error("Supabase: brak klucza");
    SKEY = { v: k, at: Date.now() };
  }
  const res = await fetch(`https://${PROJECT_REF}.supabase.co/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SKEY.v, Authorization: `Bearer ${SKEY.v}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(8000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase RPC ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;   // funkcja bez wyniku odsyła pustą odpowiedź
}

// Bezpieczne opakowanie wartości w dollar-quoting (ogranicznik unikalny względem treści).
// Tekst w cudzysłowie dolarowym: znacznik, którego nie ma w treści ($q$, $q1$, $q2$…).
// (Wcześniej .replace("$", "$$") nic nie zmieniało — tekst z „$q$” zapętlał funkcję.)
export function escStr(value) {
  const s = String(value);
  let d = "$q$";
  // Znacznik zamykający musi wystąpić dopiero na końcu (także gdy treść kończy się np. na „$q”).
  for (let n = 1; (s + d).indexOf(d) !== s.length; n++) d = `$q${n}$`;
  return `${d}${s}${d}`;
}

export function esc(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return escStr(value);
}

// IP klienta. Brzeg platformy (Cloudflare przed exmortis.pl i *.base44.app) ustawia True-Client-IP na prawdziwy
// adres odwiedzającego i nadpisuje wartość podaną przez klienta (sprawdzone 16.10.2026: podrobiony nagłówek
// nie przechodzi). cf-connecting-ip / x-real-ip zawierają tu adres WEWNĘTRZNEGO pośrednika platformy (74.220.48.x),
// wspólny dla wielu odwiedzających — limity liczone po nim blokowały obcych sobie ludzi naraz. Zostają tylko jako zapas.
// X-Forwarded-For pomijamy: jego pierwsza wartość pochodzi od klienta (można podać dowolną).
export function clientIp(req) {
  const ok = (v) => /^[0-9a-fA-F:.]{3,45}$/.test(v);
  const t = (req.headers.get("true-client-ip") || "").trim();
  if (ok(t)) return t;
  const v = (req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "").trim();
  return ok(v) ? v : "brak";
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Skraca i waliduje pole tekstowe formularza; zwraca null, gdy niepoprawne.
export function textField(body, key, { max = 2000, required = true } = {}) {
  const v = body ? body[key] : undefined;
  if (v === undefined || v === null || String(v).trim() === "") {
    if (required) { const e = new Error(`Brak pola: ${key}`); e.isValidation = true; throw e; }
    return null;
  }
  const s = String(v).trim();
  if (s.length > max) { const e = new Error(`Pole ${key} jest zbyt długie`); e.isValidation = true; throw e; }
  return s;
}

export function emailField(body, key = "email") {
  const v = textField(body, key, { max: 320 });
  if (!EMAIL_RE.test(v)) { const e = new Error("Niepoprawny adres e-mail"); e.isValidation = true; throw e; }
  return v;
}

// Administrator albo rola „techniczna” (ustawienia, treści, wygląd — bez danych osobowych).
export async function requireStaff(base44) {
  const user = await base44.auth.me().catch(() => null);
  if (!user || (user.role !== "admin" && user.role !== "techniczna")) throw new Error("FORBIDDEN");
  return user;
}

// Wymaga zalogowanego administratora; rzuca FORBIDDEN, gdy brak dostępu.
export async function requireAdmin(base44) {
  const user = await base44.auth.me().catch(() => null);
  if (!user || user.role !== "admin") {
    throw new Error("FORBIDDEN");
  }
  return user;
}