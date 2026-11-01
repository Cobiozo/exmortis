// Formatowanie, filtrowanie i eksport listy kont (sekcja 03 Klienci i dostępy → KONTA).
// Ochrona przed formułami w Excelu: = + - @ poprzedzone apostrofem.
export const csvCell = (v) => {
  const s = String(v ?? "");
  const x = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
  return /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x;
};

export const fmtDay = (iso) =>
  iso ? new Date(iso).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

export const ageDays = (iso) => Math.floor((Date.now() - new Date(iso || 0).getTime()) / 86400000);

export const fmtAgo = (iso) => {
  if (!iso) return "nigdy";
  const d = ageDays(iso);
  return d <= 0 ? "dziś" : d === 1 ? "1 dzień temu" : `${d} dni temu`;
};

export const FILTERS = [
  { key: "all", label: "Wszystkie" },
  { key: "new", label: "Nowe (7 dni)" },
  { key: "idle", label: "Nieaktywne 30+ dni" },
  { key: "unconfirmed", label: "Niepotwierdzone" },
  { key: "has_access", label: "Z dostępami" },
];

export const matchesFilter = (a, f) =>
  f === "new" ? ageDays(a.created_at) < 7
  : f === "idle" ? (!a.last_sign_in_at || ageDays(a.last_sign_in_at) >= 30)
  : f === "unconfirmed" ? !a.email_confirmed
  : f === "has_access" ? a.accesses > 0
  : true;

export const matchesQuery = (a, q) => {
  const s = q.trim().toLowerCase();
  return !s || `${a.email} ${a.name || ""}`.toLowerCase().includes(s);
};

export const SORTS = {
  name: (a) => (a.name || a.email).toLowerCase(),
  role: (a) => a.role,
  created_at: (a) => a.created_at || "",
  last_sign_in_at: (a) => a.last_sign_in_at || "",
  email_confirmed: (a) => (a.email_confirmed ? 1 : 0),
  provider: (a) => a.provider,
  accesses: (a) => a.accesses,
  blocked: (a) => (a.blocked ? 1 : 0),
};

export const sortRows = (rows, key, dir) =>
  [...rows].sort((x, y) => {
    const a = SORTS[key] ? SORTS[key](x) : "";
    const b = SORTS[key] ? SORTS[key](y) : "";
    const r = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "pl");
    return dir === "asc" ? r : -r;
  });

// Eksport wyłącznie kolumn z tabeli.
export const accountsCsv = (rows) => [
  "imie_i_email,rola,zalozenie,ostatnie_logowanie,email_potwierdzony,logowanie_przez,dostepy,status",
  ...rows.map((a) => [
    a.name ? `${a.name} <${a.email}>` : a.email,
    a.role,
    a.created_at ? a.created_at.slice(0, 10) : "",
    a.last_sign_in_at ? a.last_sign_in_at.slice(0, 16).replace("T", " ") : "",
    a.email_confirmed ? "tak" : "nie",
    a.provider,
    a.accesses,
    a.blocked ? "zablokowane" : "aktywne",
  ].map(csvCell).join(",")),
].join("\n");