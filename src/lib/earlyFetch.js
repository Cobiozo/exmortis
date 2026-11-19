// Wczesne pobieranie danych (19.11.2026, szybkość): skrypt w index.html wysyła zapytanie o katalog
// (shopProducts) jeszcze zanim wczyta się aplikacja — tylko dla gościa na /skarbiec i /skarbiec/:slug.
// Tu aplikacja odbiera tę gotową odpowiedź (jeden raz, przy zgodnych parametrach); w każdym innym
// przypadku albo przy błędzie wraca do zwykłego wywołania.
import { base44 } from "@/api/base44Client";

export function invokeEarly(name, payload) {
  const run = () => base44.functions.invoke(name, payload);
  try {
    const e = window.__exmEarly;
    if (e && !e.used && e.name === name && e.body === JSON.stringify(payload || {})) {
      e.used = true;
      return e.p.then((d) => (d && Array.isArray(d.products) ? { data: d } : run())).catch(run);
    }
  } catch { /* zwykłe wywołanie */ }
  return run();
}
