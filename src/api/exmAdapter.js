// Adapter danych — krok 3 planu wyjścia z Base44 (src/docs/tech/MIGRACJA.md).
//
// Cała aplikacja woła `base44.entities.X.filter(...)`, `base44.auth.me()`,
// `base44.functions.invoke(...)` itd. Przez adapter przechodzi każde takie wywołanie:
// dziś adapter przekazuje je 1:1 do klienta Base44 (zero zmian działania),
// a przy przejściu na Supabase podmienia się tylko ten plik — 130 miejsc w kodzie zostaje.
//
// Wywołania przenoszone do Supabase w kolejności: encje (tabele Postgres), pliki (Storage),
// logowanie (Supabase Auth), wywołania funkcji (Edge Functions).

import { base44 as raw } from "./rawBase44";
import { hasSupabase, supabaseEntityOps } from "./exmSupabase";

// Przełącznik odczytu encji: "base44" (domyślnie) albo "supabase" (statyczny build).
export const ENTITY_BACKEND = import.meta.env.VITE_EXM_ENTITY_BACKEND === "supabase" ? "supabase" : "base44";
const READ_OPS = ["get", "filter", "list", "count"];

// Odczyty z kopii tylko dla kolekcji publicznych — polityki w bazie (exm_read_public)
// odwzorowują odczyt gościa. Panele administratora i dane kont (Access, Consent, postępy)
// zostają na Base44 do czasu migracji logowania (docs/tech/MIGRACJA.md).
const SUPABASE_READ = new Set([
  "PublishedPage", "SiteNav", "PageRedirect", "LegalDocVersion", "PodcastSettings",
  "PodcastEpisode", "PodcastPlaylist", "Utwor", "SilenceSettings",
]);

function wrapEntity(entity, name) {
  const ops = ENTITY_BACKEND === "supabase" && hasSupabase && SUPABASE_READ.has(name) ? supabaseEntityOps(name) : null;
  return new Proxy(entity, {
    get(target, prop) {
      if (ops && READ_OPS.includes(prop)) {
        // Kopia nie odpowiada → zapasowy odczyt z aplikacji (strona żyje bez Supabase).
        const op = ops[prop];
        return async (...args) => {
          try {
            return await op(...args);
          } catch (e) {
            console.error("odczyt:Supabase", name, String(prop), String(e?.message || e).slice(0, 200));
            const fallback = target[prop];
            return fallback.apply(target, args);
          }
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
      return wrapEntity(entity, String(name));
    },
  });
}

export function createExmClient(raw) {
  return new Proxy(raw, {
    get(target, prop) {
      if (prop === "entities") return wrapEntities(target.entities);
      const value = target[prop];
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export const base44 = createExmClient(raw);