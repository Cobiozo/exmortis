// Wspólny dostęp do projektu Supabase (exmortis) przez Management API łącznika.

const PROJECT_REF = "fqhvxhnbeyvwubpnuzxe";
const QUERY_URL = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

export async function runSql(base44, query, readOnly = false) {
  const { accessToken } = await base44.asServiceRole.connectors.getConnection("supabase");
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

// Bezpieczne opakowanie wartości w dollar-quoting (ogranicznik unikalny względem treści).
export function escStr(value) {
  const s = String(value);
  let d = "$q$";
  while (s.includes(d)) d = d.replace("$", "$$");
  return `${d}${s}${d}`;
}

export function esc(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return escStr(value);
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Skraca i waliduje pole tekstowe formularza; zwraca null, gdy niepoprawne.
export function textField(body, key, { max = 2000, required = true } = {}) {
  const v = body ? body[key] : undefined;
  if (v === undefined || v === null || String(v).trim() === "") {
    if (required) throw new Error(`Brak pola: ${key}`);
    return null;
  }
  const s = String(v).trim();
  if (s.length > max) throw new Error(`Pole ${key} jest zbyt długie`);
  return s;
}

export function emailField(body, key = "email") {
  const v = textField(body, key, { max: 320 });
  if (!EMAIL_RE.test(v)) throw new Error("Niepoprawny adres e-mail");
  return v;
}