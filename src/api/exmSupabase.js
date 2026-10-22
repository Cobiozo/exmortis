// Czytanie encji wprost z Supabase (PostgREST) — tryb dla statycznego buildu:
// VITE_EXM_ENTITY_BACKEND=supabase + VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY w .env.local.
//
// Rekordy trzymamy 1:1 w kolumnie jsonb `data` (patrz: kopiowanie w migracji), więc odczyt
// zwraca dokładnie ten sam kształt, co Base44. Goście widzą wyłącznie dane publiczne —
// polityki w bazie (exm_read_public) odwzorowują reguły odczytu z Base44. Zapisy, aggregate
// i operacje dla zalogowanych zostają na Base44 do czasu migracji logowania.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabase = Boolean(SUPABASE_URL && ANON_KEY);

const PAGE = 500;

const headers = () => ({ apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` });

// Wartości w porównaniach prostych idzą bez cudzysłowów (zweryfikowane na PostgREST),
// w listach in./not.in. — w cudzysłowach, żeby przecinki i nawiasy nie zepsuły zapytania.
const val = (v) => encodeURIComponent(String(v));
const inVal = (v) => `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
const col = (f) => `data->>${encodeURIComponent(f)}`;

const OP_MAP = { $ne: "neq", $gt: "gt", $gte: "gte", $lt: "lt", $lte: "lte" };

function atom(field, cond) {
  if (cond === null) return `${col(field)}=is.null`;
  if (cond === true || cond === false) return `${col(field)}=eq.${cond}`;
  if (typeof cond !== "object" || Array.isArray(cond)) {
    return Array.isArray(cond) ? `${col(field)}=in.(${cond.map(inVal).join(",")})` : `${col(field)}=eq.${val(cond)}`;
  }
  const [op, v] = Object.entries(cond)[0];
  if (op === "$in" || op === "$nin") {
    const list = Array.isArray(v) ? v : [v];
    return `${col(field)}=${op === "$in" ? "in" : "not.in"}.(${list.map(inVal).join(",")})`;
  }
  if (op === "$exists") return `${col(field)}=is.${v ? "not.null" : "null"}`;
  if (op === "$regex") return `${col(field)}=like.*${encodeURIComponent(String(v))}*`;
  if (op in OP_MAP) return `${col(field)}=${OP_MAP[op]}.${val(v)}`;
  throw new Error(`Nieobsługiwany operator filtra: ${op}`);
}

function conditions(query) {
  const parts = [];
  for (const [field, cond] of Object.entries(query || {})) {
    if (field === "$or" || field === "$and") {
      const sep = field === "$or" ? "or" : "and";
      parts.push(`${sep}=(${(cond || []).map((sub) => {
        const [f, c] = Object.entries(sub)[0];
        return atom(f, c).replace("=", ".");
      }).join(",")})`);
    } else {
      parts.push(atom(field, cond));
    }
  }
  return parts;
}

function orderExpr(sort) {
  // "-created_date" → malejąco po kolumnie systemowej; pole danych → data->>pole
  const dir = String(sort).startsWith("-") ? "desc" : "asc";
  const field = String(sort).replace(/^-/, "");
  const built = ["created_date", "updated_date"].includes(field);
  return `${built ? field : encodeURIComponent("data->>" + field)}.${dir}`;
}

async function fetchRows(table, qs) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, { headers: headers(), signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
  // Pełny kształt rekordu jak w aplikacji: pola we wnętrzu `data` + pola systemowe z kolumn.
  const row2rec = (r) => ({ ...(r.data || {}), id: r.id, created_date: r.created_date, updated_date: r.updated_date, created_by_id: r.created_by_id });
  return (await res.json()).map(row2rec);
}

export function supabaseEntityOps(entityName) {
  const table = "exm_" + entityName.toLowerCase();

  return {
    async get(id) {
      const rows = await fetchRows(table, `id=eq.${val(id)}&limit=1`);
      return rows[0] || null;
    },

    // Bez options → tablica rekordów (jak Base44); z options → strona {items, next_cursor, has_more}.
    async filter(query = {}, options) {
      const parts = conditions(query);
      const sort = options?.sort ? `&order=${orderExpr(options.sort)}` : "";
      if (!options || (!options.limit && !options.cursor && !options.sort)) {
        return fetchRows(table, parts.join("&") || "select=*");
      }
      const offset = Number(options.cursor ?? 0) || 0;
      const limit = Math.max(1, Math.min(Number(options.limit) || 50, 2000));
      const qs = `${parts.join("&")}${sort}&limit=${limit + 1}&offset=${offset}`;
      const rows = await fetchRows(table, qs);
      const has_more = rows.length > limit;
      return { items: has_more ? rows.slice(0, limit) : rows, next_cursor: has_more ? String(offset + limit) : null, has_more };
    },

    async list(options = {}) {
      // list({distinct: 'pole'}) → {items: wartości} — jak w Base44.
      if (options.distinct) {
        const rows = await fetchRows(table, `select=v:${encodeURIComponent(`data->>${options.distinct}`)}&limit=2000`);
        return { items: [...new Set(rows.map((r) => r.v).filter((v) => v !== null && v !== undefined)) ] };
      }
      return this.filter({}, options);
    },

    async count(query = {}) {
      const parts = conditions(query);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${parts.join("&") || "select=id"}&limit=0`, {
        method: "HEAD",
        headers: { ...headers(), Prefer: "count=exact" },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`Supabase ${res.status}`);
      const range = res.headers.get("Content-Range") || "/0";
      return Number(range.split("/")[1]) || 0;
    },
  };
}