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

function wrapEntity(entity) {
  return new Proxy(entity, {
    get(target, prop) {
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
      return wrapEntity(entity);
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