// Replikacja danych aplikacji do kopii w Supabase (tabele exm_*).
// Pełna kopia (raz, z wznawianiem) + synchronizacja przyrostowa po updated_date (tick co 5 minut).
// Zapisy w aplikacji zawsze idą do bazy Base44; kopia służy odczytom. Usunięte rekordy
// przenoszą się dopiero przy kolejnej pełnej kopii (przyrostowe upserty niczego nie usuwają).
import { runSql, escStr } from "./supabase.ts";
import { getSetting, saveSetting } from "./settings.ts";

// Kolekcje w kolejności replikacji: najpierw te czytane przez gości (przełącznik adaptera),
// potem reszta. User pominięty — konta zostają w aplikacji (logowanie migruje osobno).
export const REPLICATE = [
  "PublishedPage", "SiteNav", "PageRedirect", "LegalDocVersion", "PodcastSettings",
  "PodcastEpisode", "PodcastPlaylist", "Utwor", "SilenceSettings",
  "Product", "DiscountCode", "PodcastGuest", "ObokSeria", "ObokNagranie",
  "Access", "Consent", "License", "Withdrawal", "CourseLesson", "PodcastApplication",
  "PowrotApplication", "ContactMessage", "Announcement", "AnnouncementSeen", "AnnouncementLog",
  "PageVersion", "CmsSection", "ContentLog", "MediaAsset", "PublicSnapshot",
  "NotificationState", "ObokUczestnik", "ObokOdsluch", "PlaybackLog", "LessonProgress",
  "ActiveStream", "EmailChange", "PendingRegistration", "SilenceBackground", "SilenceTrack",
  "SilenceSoundtrack", "SilenceSignal", "BackupFile", "ClientError", "DataAccessLog",
  "SecurityLog", "MailQueue", "RozdrozaChoice", "RozdrozaScene", "RozdrozaStory",
];

export const TABLE = (entity) => `exm_${entity.toLowerCase()}`;
const nowIso = () => new Date().toISOString();

async function ensureTable(base44, entity) {
  const t = TABLE(entity);
  await runSql(
    base44,
    `CREATE TABLE IF NOT EXISTS public.${t} (
       id text PRIMARY KEY,
       data jsonb NOT NULL DEFAULT '{}'::jsonb,
       created_date timestamptz NOT NULL DEFAULT now(),
       updated_date timestamptz NOT NULL DEFAULT now(),
       created_by_id text
     );
     CREATE INDEX IF NOT EXISTS ${t}_data_gin ON public.${t} USING gin (data jsonb_path_ops);
     CREATE INDEX IF NOT EXISTS ${t}_updated_idx ON public.${t} (updated_date);`
  );
}

// Wiersz kopii: pola rekordu we wnętrzu `data` (bez pól systemowych — te są w kolumnach).
function rowValues(rec) {
  const data = { ...rec };
  delete data.id;
  delete data.created_date;
  delete data.updated_date;
  delete data.created_by_id;
  const cd = rec.created_date ? `${escStr(rec.created_date)}::timestamptz` : "now()";
  const ud = rec.updated_date ? `${escStr(rec.updated_date)}::timestamptz` : "now()";
  return `(${escStr(rec.id)}, ${escStr(JSON.stringify(data))}::jsonb, ${cd}, ${ud}, ${rec.created_by_id ? escStr(rec.created_by_id) : "NULL"})`;
}

// Upsert partiami — jeden INSERT na maks. ~120 wierszy albo ~400 KB treści (duże sceny ROZDROŻA).
export async function upsertRows(base44, entity, recs) {
  if (!recs.length) return 0;
  await ensureTable(base44, entity);
  const chunks = [];
  let cur = [], bytes = 0;
  for (const rec of recs) {
    const b = JSON.stringify(rec).length;
    if (cur.length && (cur.length >= 120 || bytes + b > 400000)) { chunks.push(cur); cur = []; bytes = 0; }
    cur.push(rec); bytes += b;
  }
  if (cur.length) chunks.push(cur);
  let n = 0;
  for (const chunk of chunks) {
    const values = chunk.map(rowValues).join(",");
    await runSql(
      base44,
      `INSERT INTO public.${TABLE(entity)} (id, data, created_date, updated_date, created_by_id)
       VALUES ${values}
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_date = EXCLUDED.updated_date`
    );
    n += chunk.length;
  }
  return n;
}

// Wszystkie rekordy encji (strony po 500, od najnowszych).
// Strony offsetowe bez stabilnego sortowania mogą zdublować rekord o tej samej dacie — deduplikacja po id.
async function readAll(base44, entity) {
  const seen = new Set();
  const out = [];
  for (let i = 0; ; i += 500) {
    const rows = await base44.asServiceRole.entities[entity].list("-updated_date", 500, i);
    for (const r of rows || []) if (r && r.id && !seen.has(r.id)) { seen.add(r.id); out.push(r); }
    if (!rows || rows.length < 500) break;
  }
  return out;
}

// ==== PEŁNA KOPIA (jednorazowo, z wznawianiem — stan w ustawieniu „replikacja") ====
export async function replicateFull(base44, { only, budgetMs = 210000 } = {}) {
  const st = (await getSetting(base44, "replikacja")) || { full_done: [], since: {} };
  const done = new Set(st.full_done || []);
  const start = Date.now();
  const results = [];
  for (const e of REPLICATE) {
    if (done.has(e)) continue;
    if (only && e !== only) continue;
    if (results.length && Date.now() - start > budgetMs) { results.push({ wstrzymano: true, pozostalo: REPLICATE.filter((x) => !done.has(x)) }); break; }
    try {
      const recs = await readAll(base44, e);
      const n = await upsertRows(base44, e, recs);
      done.add(e);
      st.full_done = [...done];
      st.since = { ...(st.since || {}), [e]: nowIso() };
      await saveSetting(base44, "replikacja", st);
      results.push({ encja: e, wierszy: n });
    } catch (err) {
      results.push({ encja: e, blad: String(err?.message || err).slice(0, 200) });
    }
  }
  return { gotowe: done.size, wszystkie: REPLICATE.length, pelna: REPLICATE.every((x) => done.has(x)), przebieg: results };
}

// ==== PRZYROST (tick) ====
export async function replicateDelta(base44, { limitMs = 90000 } = {}) {
  const st = (await getSetting(base44, "replikacja")) || { full_done: [], since: {} };
  const since = st.since || {};
  const zmiany = {};
  const start = Date.now();
  for (const e of REPLICATE) {
    if (!since[e]) continue; // pełna kopia tej kolekcji jeszcze nie gotowa
    if (Date.now() - start > limitMs) break;
    try {
      const page = await base44.asServiceRole.entities[e].filter({ updated_date: { $gt: since[e] } }, "updated_date", 500);
      const recs = (page || []).filter((r) => r && r.id);
      if (recs.length) {
        await upsertRows(base44, e, recs);
        zmiany[e] = recs.length;
        st.since[e] = String(recs[recs.length - 1].updated_date || nowIso());
      }
    } catch (err) {
      zmiany[e] = `blad: ${String(err?.message || err).slice(0, 150)}`;
    }
  }
  if (Object.keys(zmiany).length) await saveSetting(base44, "replikacja", st);
  return { zmiany };
}

export async function replikacjaStatus(base44) {
  const st = (await getSetting(base44, "replikacja")) || { full_done: [], since: {} };
  return { gotowe: (st.full_done || []).length, wszystkie: REPLICATE.length, pelna: REPLICATE.every((x) => (st.full_done || []).includes(x)), brakujace: REPLICATE.filter((x) => !(st.full_done || []).includes(x)) };
}