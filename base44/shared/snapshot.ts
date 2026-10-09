import { waitUntil } from "base44:runtime";

// Kopia publicznych danych z Supabase w bazie aplikacji (PublicSnapshot).
// Odczyt: pamięć instancji → kopia w bazie aplikacji. Supabase wyłącznie w tle.
// Tylko gdy kopii nie ma wcale — jedno zapytanie z limitem 2 s.
const MEM = new Map<string, { v: unknown; at: number }>();
const TTL = 60000;
const LIMIT = 2000;
const busy = new Set<string>();

const timeout = <T>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("Limit czasu Supabase")), ms))]);

export async function getSnap(base44, key: string, loader: () => Promise<unknown>) {
  const t0 = Date.now();
  const m = MEM.get(key);
  if (m) {
    if (Date.now() - m.at >= TTL) bg(base44, key, loader);
    return m.v;
  }
  const ent = base44.asServiceRole.entities.PublicSnapshot;
  const row = (await ent.filter({ key }, "-refreshed_at", 1).catch(() => []))[0];
  const t1 = Date.now();
  if (row) {
    const age = Date.now() - Date.parse(row.refreshed_at || 0);
    const v = row.value?.v;
    MEM.set(key, { v, at: Date.now() - Math.min(age, TTL) });
    if (age >= TTL) bg(base44, key, loader, row.id);
    console.log(`[snap] ${key} kopia z bazy ${t1 - t0} ms`);
    return v;
  }
  const v = await timeout(refresh(base44, key, loader, null), LIMIT);
  console.log(`[snap] ${key} brak kopii: baza ${t1 - t0} ms, Supabase ${Date.now() - t1} ms`);
  return v;
}

function bg(base44, key, loader, id = undefined) {
  if (busy.has(key)) return;
  busy.add(key);
  waitUntil(refresh(base44, key, loader, id).catch(() => {}).finally(() => busy.delete(key)));
}

async function refresh(base44, key, loader, id) {
  const ent = base44.asServiceRole.entities.PublicSnapshot;
  const v = await loader();
  MEM.set(key, { v, at: Date.now() });
  const data = { key, value: { v }, refreshed_at: new Date().toISOString() };
  if (id === undefined) id = (await ent.filter({ key }, "-refreshed_at", 1).catch(() => []))[0]?.id || null;
  if (id) await ent.update(id, data); else await ent.create(data);
  return v;
}

// Po zapisie w panelu: kopie z prefiksem oznaczamy jako stare (nie usuwamy),
// żeby goście dostali kopię od razu, a nowa wersja doszła w tle.
export async function clearSnap(base44, prefix: string) {
  for (const k of MEM.keys()) if (k.startsWith(prefix)) MEM.delete(k);
  const ent = base44.asServiceRole.entities.PublicSnapshot;
  const rows = await ent.filter({ key: { $regex: `^${prefix}` } }).catch(() => []);
  await Promise.all(rows.map((r) => ent.update(r.id, { refreshed_at: "2000-01-01T00:00:00.000Z" }).catch(() => {})));
}