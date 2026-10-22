// Warstwa odczytów z kopii Supabase dla zalogowanych — dane kont i panele administratora.
//
// Zapisy nadal idą do bazy aplikacji (Base44), która od razu kopiuje rekord do Supabase
// (funkcja replicateOne) — po ok. sekundzie odczyt z kopii go widzi. Bramka supabaseData
// egzekwuje TUTAJ dokładnie te same reguły odczytu co reguły encji w aplikacji:
// gość nic tu nie przeczyta, użytkownik widzi tylko swoje wiersze, panele — administracja.
import { restGet, restCount } from "./supabase.ts";
import { REPLICATE, TABLE } from "./replicate.ts";

const SYSTEM = new Set(["id", "created_date", "updated_date", "created_by_id"]);
const FETCH_CAP = 3000;

const q = (v) => encodeURIComponent(String(v));
const inVal = (v) => `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
const col = (f) => (SYSTEM.has(f) ? f : `data->>${q(f)}`);

function forbidden() {
  const e = new Error("FORBIDDEN");
  e.forbidden = true;
  throw e;
}

// ==== Reguły odczytu (odwzorowanie reguł encji aplikacji) ====
// open = każdy zalogowany; admin; staff = admin+techniczna; email = swoje wiersze (user_email)
// albo obsługa; aktywne/aktywny = aktywne publicznie albo obsługa; opublikowany/widoczna = j.w.
const RULES = {
  open: ["PublishedPage", "SiteNav", "PageRedirect", "LegalDocVersion", "PodcastSettings", "Utwor", "SilenceSettings"],
  email: ["Access", "LessonProgress"],
  aktywne: ["SilenceBackground"],
  aktywny: ["SilenceSignal", "SilenceSoundtrack", "SilenceTrack"],
  opublikowany: ["PodcastEpisode"],
  widoczna: ["PodcastPlaylist"],
  staff: ["SitePage", "PageVersion", "CmsSection", "ContentLog", "MediaAsset"],
};

export function readRule(entity) {
  for (const [k, list] of Object.entries(RULES)) if (list.includes(entity)) return k;
  return "admin"; // każda kolekcja bez jawnej reguły — tylko administracja (jak w aplikacji)
}

// Fragment zapytania dopisujący regułę dla zwykłego użytkownika ("" = brak dopisku).
function ruleWhere(user, entity) {
  const isStaff = user.role === "admin" || user.role === "techniczna";
  switch (readRule(entity)) {
    case "open": return "";
    case "staff": if (isStaff) return ""; break;
    case "admin": if (user.role === "admin") return ""; break;
    case "email": if (isStaff) return ""; return `${col("user_email")}=eq.${q(user.email)}`;
    case "aktywne": if (isStaff) return ""; return `${col("aktywne")}=eq.true`;
    case "aktywny": if (isStaff) return ""; return `${col("aktywny")}=eq.true`;
    case "opublikowany": if (user.role === "admin") return ""; return `${col("status")}=in.(${inVal("opublikowany")},${inVal("zaplanowany")})`;
    case "widoczna": if (user.role === "admin") return ""; return `${col("widoczna")}=eq.true`;
  }
  forbidden();
}

// ==== Budowa warunków (PostgREST) ====
function atom(field, cond) {
  if (cond === null) return `${col(field)}=is.null`;
  if (typeof cond === "boolean") return `${col(field)}=eq.${cond}`;
  if (Array.isArray(cond)) return `${col(field)}=in.(${cond.map(inVal).join(",")})`;
  if (typeof cond === "object") {
    const [op, v] = Object.entries(cond)[0];
    if (op === "$in" || op === "$nin") {
      const list = Array.isArray(v) ? v : [v];
      return `${col(field)}=${op === "$in" ? "in" : "not.in"}.(${list.map(inVal).join(",")})`;
    }
    if (op === "$exists") return `${col(field)}=is.${v ? "not.null" : "null"}`;
    if (op === "$ne") return `${col(field)}=neq.${q(v)}`;
    if (op === "$gt" || op === "$gte" || op === "$lt" || op === "$lte") {
      const map = { $gt: "gt", $gte: "gte", $lt: "lt", $lte: "lte" };
      return `${col(field)}=${map[op]}.${q(v)}`;
    }
    if (op === "$regex") {
      const nocase = String(cond.$options || "").includes("i");
      const p = String(v);
      const like = nocase ? "ilike" : "like";
      if (p.startsWith("^") && p.endsWith("$")) return `${col(field)}=${like}.${q(p.slice(1, -1))}`;
      return `${col(field)}=${like}.*${q(p.replace(/\$$/, ""))}`;
    }
    throw new Error(`Nieobsługiwany operator: ${op}`);
  }
  return `${col(field)}=eq.${q(cond)}`;
}

function conditions(query) {
  const parts = [];
  for (const [field, cond] of Object.entries(query || {})) {
    if (field === "$or" || field === "$and") {
      const subs = (cond || []).map((sub) => {
        const [f, c] = Object.entries(sub)[0];
        return atom(f, c);
      });
      parts.push(`${field === "$or" ? "or" : "and"}=(${subs.join(",")})`);
    } else {
      parts.push(atom(field, cond));
    }
  }
  return parts;
}

// ==== Rekordy ====
const row2rec = (r) => ({ ...(r.data || {}), id: r.id, created_date: r.created_date, updated_date: r.updated_date, created_by_id: r.created_by_id });

const collator = new Intl.Collator("pl", { numeric: true, sensitivity: "base" });
function cmpRows(a, b, field) {
  const ka = SYSTEM.has(field) ? a[field] : (a.data || {})[field];
  const kb = SYSTEM.has(field) ? b[field] : (b.data || {})[field];
  if (ka === kb) return 0;
  if (ka == null) return 1;
  if (kb == null) return -1;
  if (typeof ka === "number" && typeof kb === "number") return ka - kb;
  const c = collator.compare(String(ka), String(kb));
  return c !== 0 ? c : (String(ka) < String(kb) ? -1 : 1);
}

async function fetchRows(base44, table, where) {
  return restGet(base44, `${table}?${where || "select=*"}&limit=${FETCH_CAP}`);
}

function sortRows(rows, sort) {
  if (!sort) return rows;
  const field = String(sort).replace(/^-/, "");
  const dir = String(sort).startsWith("-") ? -1 : 1;
  return [...rows].sort((a, b) => dir * cmpRows(a, b, field));
}

// ==== Agregacje w pamięci (kolekcje są małe) ====
function aggregateRows(rows, args) {
  const num = (v) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" && !isNaN(Number(v)) ? Number(v) : null);
  const sums = [].concat(args.sum || []);
  const avgs = [].concat(args.avg || []);
  const mins = [].concat(args.min || []);
  const maxs = [].concat(args.max || []);
  const groups = new Map();
  for (const r of rows) {
    const data = r.data || {};
    const key = args.groupBy ? data[args.groupBy] : "all";
    const g = groups.get(key) || { count: 0 };
    g.count++;
    for (const f of sums) { const v = num(data[f]); if (v != null) g[`sum_${f}`] = (g[`sum_${f}`] || 0) + v; }
    for (const f of avgs) { const v = num(data[f]); if (v != null) { g[`avg_${f}`] = ((g[`avg_${f}`] || 0) * (g[`n_avg_${f}`] || 0) + v) / ((g[`n_avg_${f}`] || 0) + 1); g[`n_avg_${f}`] = (g[`n_avg_${f}`] || 0) + 1; } }
    for (const f of mins) { const v = num(data[f]); if (v != null && (g[`min_${f}`] == null || v < g[`min_${f}`])) g[`min_${f}`] = v; }
    for (const f of maxs) { const v = num(data[f]); if (v != null && (g[`max_${f}`] == null || v > g[`max_${f}`])) g[`max_${f}`] = v; }
    groups.set(key, g);
  }
  return [...groups.entries()].map(([k, g]) => {
    const out = args.groupBy ? { [args.groupBy]: k, count: g.count } : { count: g.count };
    for (const f of sums) if (g[`sum_${f}`] != null) out[`sum_${f}`] = g[`sum_${f}`];
    for (const f of avgs) { delete g[`n_avg_${f}`]; if (g[`avg_${f}`] != null) out[`avg_${f}`] = g[`avg_${f}`]; }
    for (const f of mins) if (g[`min_${f}`] != null) out[`min_${f}`] = g[`min_${f}`];
    for (const f of maxs) if (g[`max_${f}`] != null) out[`max_${f}`] = g[`max_${f}`];
    return out;
  });
}

// ==== Główny rozdzielacz operacji odczytu ====
export async function supaRead(base44, user, payload) {
  const { op, entity, args = {} } = payload || {};
  if (!REPLICATE.includes(entity)) forbidden();
  if (user.role === "techniczna" && readRule(entity) === "admin") forbidden();
  const table = TABLE(entity);
  const rule = ruleWhere(user, entity);
  const where = [rule, ...conditions(args.query)].filter(Boolean).join("&");

  if (op === "get") {
    const rows = await restGet(base44, `${table}?id=eq.${q(args.id)}${where ? `&${where}` : ""}&limit=1`);
    return rows[0] ? row2rec(rows[0]) : null;
  }

  if (op === "count") {
    return restCount(base44, `${table}?${where || "select=id"}`);
  }

  if (op === "list" && args.distinct) {
    const rows = await fetchRows(base44, table, where);
    const values = [...new Set(rows.map((r) => (r.data || {})[args.distinct]).filter((v) => v !== null && v !== undefined))];
    return { items: values };
  }

  if (op === "filter" || op === "list") {
    const noOptions = args.sort === undefined && args.limit === undefined && args.cursor === undefined;
    const sortField = args.sort ? String(args.sort).replace(/^-/, "") : null;

    // Sortowanie po polu systemowym robi PostgREST (stronicowanie po stronie bazy).
    if (sortField && SYSTEM.has(sortField)) {
      const dir = String(args.sort).startsWith("-") ? "desc" : "asc";
      const off = Number(args.cursor ?? 0) || 0;
      const lim = Math.max(1, Math.min(Number(args.limit) || 50, 2000));
      const rows = await restGet(base44, `${table}?${where}&order=${sortField}.${dir}&limit=${lim + 1}&offset=${off}`);
      const has_more = rows.length > lim;
      const items = has_more ? rows.slice(0, lim) : rows;
      if (args.array) return items.map(row2rec);
      return { items: items.map(row2rec), next_cursor: has_more ? String(off + lim) : null, has_more };
    }

    // Pole danych: pobieramy pasujące wiersze i sortujemy w pamięci (poprawnie i dla liczb).
    const rows = sortRows(await fetchRows(base44, table, where), args.sort);
    const recs = rows.map(row2rec);
    if (noOptions) return recs;
    const off = Number(args.cursor ?? 0) || 0;
    const lim = Math.max(1, Math.min(Number(args.limit) || 50, 2000));
    if (args.array) return recs.slice(off, off + lim);
    const has_more = recs.length > off + lim;
    return { items: recs.slice(off, off + lim), next_cursor: has_more ? String(off + lim) : null, has_more };
  }

  if (op === "aggregate") {
    const rows = await fetchRows(base44, table, where);
    return { rows: aggregateRows(rows, args) };
  }

  throw new Error(`Nieznana operacja: ${op}`);
}