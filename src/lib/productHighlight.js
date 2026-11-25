import { isPromoActive } from "@/lib/productPrice";

// Znaczek na okładce produktu — jedno miejsce decydujące, co pokazać (najwyżej jeden na kartę).
// Kolejność: ręczne ustawienie z panelu → automat (najpierw promocja, potem nowość) → brak.
// „auto”: promocja, gdy trwa promocja produktu; nowość przez 30 dni od udostępnienia.
export const HIGHLIGHT_VALUES = ["auto", "brak", "nowosc", "promocja", "rabat"];

export const HIGHLIGHT_OPTIONS = [
  { value: "auto", label: "Automatycznie" },
  { value: "brak", label: "Brak" },
  { value: "nowosc", label: "Nowość" },
  { value: "promocja", label: "Promocja" },
  { value: "rabat", label: "Rabat" },
];

export const HIGHLIGHT_HINT =
  "Automatycznie: Promocja, gdy trwa promocja produktu; Nowość przez 30 dni od daty udostępnienia";

const NEW_MS = 30 * 24 * 60 * 60 * 1000;

const stamp = (v) => {
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
};

export function productHighlight(p) {
  if (!p) return null;
  const mode = HIGHLIGHT_VALUES.includes(p.wyroznienie) ? p.wyroznienie : "auto";
  if (mode === "brak") return null;
  if (mode !== "auto") return mode;
  // Zapowiedź („wkrótce”) nie jest nowością — znaczek nowości dostaje produkt dostępny.
  if (p.status === "wkrótce") return null;
  if (isPromoActive(p)) return "promocja";
  const t = stamp(p.available_at) ?? stamp(p.release_at);
  if (t == null) return null;
  const age = Date.now() - t;
  return age >= 0 && age <= NEW_MS ? "nowosc" : null;
}
// Zakładka „Nowości” w Skarbcu: produkt dostępny, oznaczony w panelu jako Nowość albo (Automatycznie)
// udostępniony w ciągu ostatnich 30 dni. „Brak” wyłącza produkt z nowości.
export function isNewProduct(p) {
  if (!p || p.status === "wkrótce") return false;
  const mode = HIGHLIGHT_VALUES.includes(p.wyroznienie) ? p.wyroznienie : "auto";
  if (mode === "nowosc") return true;
  if (mode !== "auto") return false;
  const t = stamp(p.available_at) ?? stamp(p.release_at);
  if (t == null) return false;
  const age = Date.now() - t;
  return age >= 0 && age <= NEW_MS;
}
export const newSortKey = (p) => stamp(p.available_at) ?? stamp(p.release_at) ?? 0;
