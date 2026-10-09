// Kopia publicznych danych w przeglądarce (bez danych osobowych): render od razu, odświeżenie w tle.
const V = 1;
const MAX_AGE = 7 * 86400000;

export function readCache(key) {
  try {
    const c = JSON.parse(localStorage.getItem("exm_c_" + key));
    if (!c || c.v !== V || Date.now() - c.at > MAX_AGE) return undefined;
    return c.data;
  } catch { return undefined; }
}

export function writeCache(key, data) {
  try { localStorage.setItem("exm_c_" + key, JSON.stringify({ v: V, at: Date.now(), data })); } catch { /* pełna pamięć */ }
}