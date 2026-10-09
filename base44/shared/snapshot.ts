import { waitUntil } from "base44:runtime";

// Kopia publicznych danych z Supabase w bazie aplikacji (PublicSnapshot).
// Odczyt: pamięć instancji → kopia w bazie aplikacji → (brak) Supabase.
// Kopia starsza niż 60 s jest zwracana od razu, a odświeżana w tle.
const MEM = new Map<string, { v: unknown; at: number }>();
const TTL = 60000;

export async function getSnap(base44, key: string, loader: () => Promise<unknown>) {
  const m = MEM.get(key);
  if (m && Date.now() - m.at < TTL) return m.v;
  const ent = base44.asServiceRole.entities.PublicSnapshot;
  const row = (await ent.filter({ key }, "-refreshed_at", 1).catch(() => []))[0];
  if (row) {
    const age = Date.now() - Date.parse(row.refreshed_at || 0);
    const v = row.value?.v;
    MEM.set(key, { v, at: age < TTL ? Date.now() - age : Date.now() - TTL + 5000 });
    if (age >= TTL) waitUntil(refresh(ent, key, loader, row.id).catch(() => {}));
    return v;
  }
  return refresh(ent, key, loader, null);
}

async function refresh(ent, key, loader, id) {
  const v = await loader();
  const data = { key, value: { v }, refreshed_at: new Date().toISOString() };
  MEM.set(key, { v, at: Date.now() });
  if (id) await ent.update(id, data); else await ent.create(data);
  return v;
}

// Po zapisie w panelu: usuń kopie, których klucz zaczyna się od prefiksu.
export async function clearSnap(base44, prefix: string) {
  for (const k of MEM.keys()) if (k.startsWith(prefix)) MEM.delete(k);
  const ent = base44.asServiceRole.entities.PublicSnapshot;
  const rows = await ent.filter({ key: { $regex: `^${prefix}` } }).catch(() => []);
  await Promise.all(rows.map((r) => ent.delete(r.id).catch(() => {})));
}