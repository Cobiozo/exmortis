// Pakiety produktów: jeden zakup, kilka produktów w środku.
// Rozwija wiersze produktów na listę dostępów do nadania (składniki pakietów rozwinięte).
import { runSql, escStr } from "./supabase.ts";

type Row = Record<string, any>;

// Id składników zapisane na wierszu (tablica albo tekst jsonb).
function idsOf(r: Row): string[] {
  const raw = r?.bundle_items;
  let arr = raw;
  if (typeof raw === "string") {
    try { arr = JSON.parse(raw); } catch { arr = []; }
  }
  return Array.isArray(arr) ? arr.map((x) => String(x)).filter(Boolean) : [];
}

// rows: [{ id, name, product_type, access_months }] → wiersze do nadania dostępu.
// Składniki zastępują sam pakiet; dostęp składnika = access_months pakietu (jeśli ustawione), inaczej własny.
// Bez duplikatów; produkty niepakietowe przechodzą bez zmian.
export async function expandBundles(base44, rows: Row[]): Promise<Row[]> {
  const list = (rows || []).filter(Boolean);
  const pkgs = list.filter((r) => r.product_type === "pakiet" && r.id);
  if (!pkgs.length) return list;

  // Składniki pakietów — jednym zapytaniem (gdy wiersz nie przyniósł ich sam).
  const itemsByPkg = new Map<string, string[]>();
  for (const r of pkgs) itemsByPkg.set(String(r.id), idsOf(r));
  const missing = [...itemsByPkg].filter(([, v]) => !v.length).map(([k]) => k);
  if (missing.length) {
    const got = await runSql(
      base44,
      `SELECT id::text AS id, to_jsonb(p)->'bundle_items' AS bundle_items
       FROM public.products p WHERE id::text IN (${missing.map(escStr).join(",")})`,
      true
    ).catch(() => []);
    for (const g of got || []) itemsByPkg.set(String(g.id), idsOf(g));
  }

  const compIds = [...new Set([...itemsByPkg.values()].flat())];
  const comps = compIds.length
    ? await runSql(
        base44,
        `SELECT id::text AS id, name, product_type, access_months
         FROM public.products WHERE id::text IN (${compIds.map(escStr).join(",")})`,
        true
      ).catch(() => [])
    : [];
  const compById = new Map((comps || []).map((c) => [String(c.id), c]));

  const out: Row[] = [];
  const seen = new Set<string>();
  const push = (row: Row) => {
    const key = String(row?.id || "");
    if (key && seen.has(key)) return;
    if (key) seen.add(key);
    out.push(row);
  };

  const monthsOf = (v: unknown) => (v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null);

  for (const r of list) {
    if (r.product_type !== "pakiet") { push(r); continue; }
    const months = monthsOf(r.access_months);
    for (const cid of itemsByPkg.get(String(r.id)) || []) {
      const c = compById.get(String(cid));
      if (!c) continue;
      push({
        id: String(c.id),
        name: c.name,
        product_type: c.product_type,
        access_months: months != null ? months : monthsOf(c.access_months),
      });
    }
  }
  return out;
}