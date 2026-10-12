import { useEffect } from "react";

// Tytuł karty i opis dla stron z danymi ładowanymi później (produkt, spotkanie).
// Ustawia po załadowaniu danych i przywraca poprzednie wartości przy wyjściu ze strony.
const strip = (x) => String(x || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

export function useDocMeta(title, description) {
  useEffect(() => {
    if (!title) return undefined;
    const prev = document.title;
    const sel = ['meta[name="description"]', 'meta[property="og:title"]', 'meta[property="og:description"]'];
    const metas = sel.map((s) => document.querySelector(s));
    const prevVals = metas.map((m) => m?.getAttribute("content"));
    const desc = strip(description).slice(0, 160);
    const apply = () => {
      document.title = title;
      if (desc) metas[0]?.setAttribute("content", desc);
      metas[1]?.setAttribute("content", title);
      if (desc) metas[2]?.setAttribute("content", desc);
    };
    apply();
    const t = setTimeout(apply, 0);
    return () => {
      clearTimeout(t);
      document.title = prev;
      metas.forEach((m, i) => { if (m && prevVals[i] != null) m.setAttribute("content", prevVals[i]); });
    };
  }, [title, description]);
}
