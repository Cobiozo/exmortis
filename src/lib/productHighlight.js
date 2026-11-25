import { isPromoActive } from "@/lib/productPrice";

// Znaczek na okładce produktu — jedno miejsce decydujące, co pokazać (najwyżej jeden na kartę).
// Kolejność: ręczne ustawienie z panelu → automat (najpierw promocja, potem nowość) → brak.
// „auto”: promocja, gdy trwa promocja produktu; nowość przez 30 dni od udostępnienia.
export const HIGHLIGHT_VALUES = ["auto", "brak", "nowosc", "promocja", "rabat"];

export const HIGHLIGHT_OPTIONS = [
  { value: "auto", label: "Automatycznie" },
  { value: "brak", label: "Brak" },
  { value: "nowosc", label: "Nowość (30 dni)" },
  { value: "promocja", label: "Promocja" },
  { value: "rabat", label: "Rabat" },
];

export const HIGHLIGHT_HINT =
  "Nowość: znaczek na okładce i zakładka „Nowości” w Skarbcu przez 30 dni od zaznaczenia. Automatycznie: Promocja, gdy trwa promocja; Nowość przez 30 dni od udostępnienia.";

const NEW_MS = 30 * 24 * 60 * 60 * 1000;

const stamp = (v) => {
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
};

// Ręczna „Nowość” trwa 30 dni od zaznaczenia (wyroznienie_od); bez daty — od udostępnienia; bez żadnej daty — trwa.
const manualNewActive = (p) => {
  const t = stamp(p.wyroznienie_od) ?? stamp(p.available_at) ?? stamp(p.release_at);
  if (t == null) return true;
  const age = Date.now() - t;
  return age >= 0 && age <= NEW_MS;
};
export const newUntil = (p) => {
  const t = stamp(p?.wyroznienie_od) ?? stamp(p?.available_at);
  return t == null ? null : new Date(t + NEW_MS);
};

export function productHighlight(p) {
  if (!p) return null;
  const mode = HIGHLIGHT_VALUES.includes(p.wyroznienie) ? p.wyroznienie : "auto";
  if (mode === "brak") return null;
  if (mode === "nowosc") return manualNewActive(p) ? "nowosc" : (isPromoActive(p) ? "promocja" : null);
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
  if (mode === "nowosc") return manualNewActive(p);
  if (mode !== "auto") return false;
  const t = stamp(p.available_at) ?? stamp(p.release_at);
  if (t == null) return false;
  const age = Date.now() - t;
  return age >= 0 && age <= NEW_MS;
}
export const newSortKey = (p) => stamp(p.wyroznienie_od) ?? stamp(p.available_at) ?? stamp(p.release_at) ?? 0;
