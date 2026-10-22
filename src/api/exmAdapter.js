// Adapter danych — krok 3 planu wyjścia z Base44 (src/docs/tech/MIGRACJA.md).
//
// Cała aplikacja woła `base44.entities.X.filter(...)`, `base44.auth.me()`,
// `base44.functions.invoke(...)` itd. Przez adapter przechodzi każde takie wywołanie:
//
// ODCZYTY (przełącznik VITE_EXM_ENTITY_BACKEND=supabase):
//  - kolekcje publiczne → wprost z Supabase (anon, polityki w bazie);
//  - dane kont i panele → bramka supabaseData (reguły dostępu egzekwowane na serwerze);
//  - awaria Supabase → odczyt wraca do bazy aplikacji (strona żyje zawsze).
//
// ZAPISY: trafiają do bazy aplikacji (źródło prawdy dla funkcji serwerowych), a funkcja
// replicateOne przenosi rekord do kopii od razu po zapisie — odczyty z Supabase widzą
// go po ok. sekundzie. Live aktualizacje (subscribe) zostają w bazie aplikacji.

import { base44 as raw } from "./rawBase44";
import { hasSupabase, supabaseEntityOps, SUPABASE_URL, ANON_KEY } from "./exmSupabase";
import { supaAuth, supaBearer } from "./exmAuth";

export const ENTITY_BACKEND = import.meta.env.VITE_EXM_ENTITY_BACKEND === "supabase" ? "supabase" : "base44";
// Logowanie na Supabase po przeniesieniu hostingu (krok 8 migracji); zmienna pozwala wrócić.
export const AUTH_BACKEND = import.meta.env.VITE_EXM_AUTH_BACKEND === "base44" ? "base44"
  : hasSupabase ? "supabase" : "base44";
const READ_OPS = ["get", "filter", "list", "count", "aggregate"];
const WRITE_OPS = ["create", "bulkCreate", "update", "updateMany", "bulkUpdate", "delete", "deleteMany"];
// Funkcje serwerowe na Supabase (krok 6 migracji) — VITE_EXM_FN_BACKEND=base44 wraca na Base44.
export const FN_BACKEND = import.meta.env.VITE_EXM_FN_BACKEND === "supabase" && hasSupabase ? "supabase" : "base44";

// Kolekcje publiczne: odczyt wprost z kopii (anon) — polityki w bazie odwzorowują reguły aplikacji.
const SUPABASE_READ = new Set([
  "PublishedPage", "SiteNav", "PageRedirect", "LegalDocVersion", "PodcastSettings",
  "PodcastEpisode", "PodcastPlaylist", "Utwor", "SilenceSettings",
]);

// Gość (bez logowania) nie ma dostępu do bramki — zapamiętujemy to na czas sesji
// i czytamy wprost z bazy aplikacji, zamiast ponawiać odrzucone wywołania.
let gatewayGuest = false;

// Po zapisie kopia dopisuje rekord przez ~1 s — w tym oknie odczyty idą z bazy aplikacji.
const FRESH = new Map();
const markFresh = (n) => FRESH.set(n, Date.now());
const isFresh = (n) => Date.now() - (FRESH.get(n) || 0) < 5000;

// Podpisy Base44: filter(query, sort, limit, cursor) albo filter(query, {sort, limit, cursor, distinct}).
function parseArgs(args) {
  const [query, second, third, fourth] = args;
  if (second && typeof second === "object" && !Array.isArray(second)) {
    return { query: query || {}, sort: second.sort, limit: second.limit, cursor: second.cursor, distinct: second.distinct };
  }
  return { query: query || {}, sort: second, limit: third, cursor: fourth, array: true };
}

// Wywołanie funkcji na Supabase (gość — klucz anonimowy, klient — token sesji).
async function supaInvoke(name, payload) {
  const token = await supaBearer().catch(() => null);
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token || ANON_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = new Error((data && data.error) || `Funkcja ${name}: ${res.status}`);
    e.status = res.status;
    e.response = { status: res.status };
    throw e;
  }
  return { data };
}

async function gatewayRead(name, op, args) {
  const res = FN_BACKEND === "supabase"
    ? await supaInvoke("supabaseData", { entity: name, op, args })
    : await raw.functions.invoke("supabaseData", { entity: name, op, args });
  return res.data && res.data.result;
}

// Przeniesienie zapisu do kopii — w tle, bez czekania i bez blokowania interfejsu.
function replicateAfter(name, ids, action) {
  for (const id of [].concat(ids).filter(Boolean)) {
    raw.functions.invoke("replicateOne", { entity: name, id, action }).catch(() => {});
  }
}

function wrapEntity(entity, name) {
  const ops = ENTITY_BACKEND === "supabase" && hasSupabase && SUPABASE_READ.has(name) ? supabaseEntityOps(name) : null;
  return new Proxy(entity, {
    get(target, prop) {
      if (ops && READ_OPS.includes(prop)) {
        // Kopia nie odpowiada → zapasowy odczyt z aplikacji (strona żyje bez Supabase).
        const op = ops[prop];
        return async (...args) => {
          if (FN_BACKEND !== "supabase" && isFresh(name)) return target[prop].apply(target, args);
          try {
            return await op(...args);
          } catch (e) {
            console.error("odczyt:Supabase", name, String(prop), String(e?.message || e).slice(0, 200));
            return target[prop].apply(target, args);
          }
        };
      }
      if (READ_OPS.includes(prop) && ENTITY_BACKEND === "supabase") {
        // Dane kont i panele: odczyt z kopii przez bramkę (reguły dostępu na serwerze).
        return async (...args) => {
          if ((FN_BACKEND !== "supabase" && isFresh(name)) || gatewayGuest) return target[prop].apply(target, args);
          try {
            const norm = prop === "get" ? { id: String(args[0]) }
              : prop === "count" ? { query: args[0] || {} }
              : prop === "aggregate" ? { ...(args[0] || {}) }
              : parseArgs(args);
            return await gatewayRead(name, prop, norm);
          } catch (e) {
            if (e?.response?.status === 401) gatewayGuest = true;
            console.error("odczyt:kopia", name, String(prop), String(e?.message || e).slice(0, 150));
            return target[prop].apply(target, args);
          }
        };
      }
      if (WRITE_OPS.includes(prop)) {
        if (FN_BACKEND === "supabase") {
          // Zapisy przez bramkę supabaseData (reguły dostępu na serwerze) — prosto do kopii.
          return async (...args) => {
            const norm = prop === "create" ? { rec: args[0] }
              : prop === "update" ? { id: args[0], patch: args[1] }
              : prop === "delete" ? { id: args[0] }
              : prop === "bulkCreate" ? { recs: args[0] }
              : prop === "bulkUpdate" ? { list: args[0] }
              : prop === "updateMany" ? { query: args[0], ops: args[1] }
              : { query: args[0] || {} };
            const res = await gatewayRead(name, prop, norm);
            markFresh(name);
            return res;
          };
        }
        return async (...args) => {
          const res = await target[prop].apply(target, args);
          markFresh(name);
          try {
            if (prop === "create") replicateAfter(name, res?.id);
            else if (prop === "update") replicateAfter(name, args[0]);
            else if (prop === "delete") replicateAfter(name, args[0], "delete");
            else if (prop === "bulkCreate") replicateAfter(name, (res || []).map((r) => r && r.id));
            else if (prop === "bulkUpdate") replicateAfter(name, (args[0] || []).map((r) => r && r.id));
            else raw.functions.invoke("replicateTick", {}).catch(() => {});
          } catch {}
          return res;
        };
      }
      const value = target[prop];
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

function wrapEntities(entities) {
  return new Proxy(entities, {
    get(target, name) {
      const entity = target[name];
      if (!entity) throw new Error(`Nieznana kolekcja danych: ${String(name)}`);
      // Konta użytkowników (logowanie) zostają w bazie aplikacji do czasu migracji logowania.
      if (String(name) === "User") return entity;
      return wrapEntity(entity, String(name));
    },
  });
}

export function createExmClient(raw) {
  return new Proxy(raw, {
    get(target, prop) {
      if (prop === "entities") return wrapEntities(target.entities);
      if (prop === "auth" && AUTH_BACKEND === "supabase") return supaAuth;
      if (prop === "functions" && FN_BACKEND === "supabase") return { invoke: supaInvoke };
      const value = target[prop];
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export const base44 = createExmClient(raw);