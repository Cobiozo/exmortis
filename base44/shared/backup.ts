import { runSql } from "./supabase.ts";

// ============ Kopia zapasowa danych ============
// Eksport najważniejszych danych do jednego pliku JSON (gzip). Każda tabela osobno — brak
// tabeli albo błąd odczytu nie przerywa całej kopii, tylko trafia do spisu z adnotacją.
// Sekrety nie trafiają do pliku: wiersze i pola z hasłami, tokenami i kluczami są pomijane.

const PAGE = 2000;        // strona odczytu dużej tabeli
const MAX_ROWS = 200000;  // bezpiecznik na jedną tabelę
export const KEEP = 8;    // ile najnowszych kopii zostawiamy

const SUPABASE_TABLES = [
  "orders", "order_refunds", "registrations", "events", "event_tickets", "products",
  "subscribers", "waitlist", "product_reviews", "discount_reservations", "app_settings",
];

// Tabele aplikacji (Base44) — bez dużych dzienników i danych technicznych.
const ENTITIES = [
  "Access", "License", "DiscountCode", "Consent", "PublishedPage", "SitePage",
  "Announcement", "RozdrozaStory", "RozdrozaScene", "RozdrozaChoice",
  "Withdrawal", "ContactMessage", "PowrotApplication",
];

// Pola, których nie zapisujemy w kopii (hasła, tokeny, klucze).
const SECRET_FIELD = /(password|haslo|hasło|secret|token|api_?key|private_?key|clientsecret|secondkey|smtp)/i;
// Wiersze app_settings, których nie zapisujemy (konfiguracja płatności, poczty, tokeny zadań).
const SECRET_ROW = /^(payu|smtp)$|token/i;

// Czyści rekord: usuwa pola z sekretami i zamienia kolumnę „key" na „name".
function clean(value) {
  if (Array.isArray(value)) return value.map((v) => clean(v));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const name = k === "key" ? "name" : k;
      if (SECRET_FIELD.test(name)) continue;
      out[name] = clean(v);
    }
    return out;
  }
  return value;
}

// Duże tabele czytamy stronami — po PAGE wierszy, aż tabela się skończy.
async function fetchTable(base44, table) {
  const rows = [];
  for (let off = 0; off < MAX_ROWS; off += PAGE) {
    const page = await runSql(base44, `SELECT * FROM public.${table} LIMIT ${PAGE} OFFSET ${off}`, true);
    if (!Array.isArray(page) || !page.length) break;
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

// Tabele modułów bk_* (rezerwacje) i mb_* (biblioteka) — bez historii zmian (mb_log).
async function prefixTables(base44) {
  const rows = await runSql(
    base44,
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND (table_name LIKE 'bk\\_%' OR table_name LIKE 'mb\\_%')
      ORDER BY table_name`,
    true
  );
  return (rows || []).map((r) => r.table_name).filter((t) => t !== "mb_log");
}

function message(e) {
  return String((e && e.message) || e).slice(0, 160);
}

// Gzip przez wbudowany strumień (Deno/Workers). Gdy niedostępny — zostaje zwykły JSON.
async function gzipBytes(bytes) {
  try {
    if (typeof CompressionStream === "undefined") return null;
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

// Robi kopię i zapisuje ją jako prywatny plik. Zwraca opis kopii (bez treści).
export async function createBackup(base44, { kto = "" } = {}) {
  const tables = [];
  const data = {};

  const dbTables = [...SUPABASE_TABLES, ...(await prefixTables(base44).catch(() => []))];
  for (const t of dbTables) {
    try {
      const rows = (await fetchTable(base44, t))
        .map((r) => clean(r))
        .filter((r) => !(t === "app_settings" && SECRET_ROW.test(String(r.name || ""))));
      data[t] = rows;
      tables.push({ table: t, rows: rows.length });
    } catch (e) {
      tables.push({ table: t, rows: 0, blad: message(e) });
    }
  }

  for (const name of ENTITIES) {
    try {
      const rows = [];
      let cursor = null;
      for (let i = 0; i < 50; i++) {
        const page = await base44.asServiceRole.entities[name].list({ sort: "-created_date", limit: 200, cursor });
        const items = Array.isArray(page) ? page : page.items || [];
        rows.push(...items.map((r) => clean(r)));
        cursor = page && page.next_cursor;
        if (!(page && page.has_more) || !cursor) break;
      }
      data[name] = rows;
      tables.push({ table: name, rows: rows.length });
    } catch (e) {
      tables.push({ table: name, rows: 0, blad: message(e) });
    }
  }

  const rows = tables.reduce((s, t) => s + (Number(t.rows) || 0), 0);
  const at = new Date().toISOString();
  const json = JSON.stringify({ meta: { created_at: at, tables }, data });
  const raw = new TextEncoder().encode(json);
  const gz = await gzipBytes(raw);
  const bytes = gz || raw;
  const format = gz ? "json.gz" : "json";
  const stamp = at.slice(0, 19).replace(/[:T]/g, "-");
  const base = { size: bytes.length, format, rows, tables, created_at: at, kto };

  try {
    const { file_uri } = await base44.asServiceRole.integrations.Core.UploadPrivateFile({
      file: new File([bytes], `exmortis-kopia-${stamp}.${format}`, {
        type: gz ? "application/gzip" : "application/json",
      }),
    });
    const rec = await base44.asServiceRole.entities.BackupFile.create({ ...base, file_uri, status: "gotowa" });
    await pruneBackups(base44);
    return { ok: true, id: rec.id, ...base };
  } catch (e) {
    await base44.asServiceRole.entities.BackupFile
      .create({ ...base, status: "blad", blad: message(e) })
      .catch(() => {});
    throw new Error(`Nie udało się zapisać kopii: ${message(e)}`);
  }
}

// Zostawia 8 najnowszych kopii; starsze wpisy usuwamy z listy.
// (Magazyn prywatny nie ma API usuwania — starsze pliki zostają w magazynie.)
export async function pruneBackups(base44) {
  const list = await base44.asServiceRole.entities.BackupFile.list("-created_date", 100).catch(() => []);
  const rows = Array.isArray(list) ? list : list.items || [];
  const old = rows.slice(KEEP);
  for (const r of old) await base44.asServiceRole.entities.BackupFile.delete(r.id).catch(() => {});
  return old.length;
}