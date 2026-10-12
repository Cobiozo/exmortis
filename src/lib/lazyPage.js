import { lazy } from "react";

// Strona ładowana na żądanie. Po publikacji nowej wersji stare pliki znikają z serwera —
// wtedy jedno automatyczne przeładowanie strony pobiera aktualną wersję (bez pętli).
const KEY = "exm_chunk_reload";
export default function lazyPage(load) {
  return lazy(() =>
    load()
      .then((m) => { try { sessionStorage.removeItem(KEY); } catch { /* */ } return m; })
      .catch((err) => {
        let done = false;
        try { done = sessionStorage.getItem(KEY) === "1"; sessionStorage.setItem(KEY, "1"); } catch { /* */ }
        if (!done) { window.location.reload(); return new Promise(() => {}); }
        throw err;
      })
  );
}
