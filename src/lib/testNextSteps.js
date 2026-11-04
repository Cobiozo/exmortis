// Następne kroki po wyniku testu — ta sama reguła co base44/shared/quizNext.ts (mail z wynikiem).
// Kolejność: Listy powrotu (główny krok) → Skarbiec → bezpłatne materiały → Spotkania →
// tylko gdy wynika z testu: Rozmowa na progu albo POWRÓT. Opis reguły oferty w quizNext.ts.
export const MAIN_SLUG = "listy-powrotu";
export const OFFER = { powrot: "powrot-mentoring", rozmowa: "rozmowa-na-progu" };
const SKIP_FREE = new Set(["listy-powrotu", "test-ktorej-smierci"]);
const FREE_ORDER = {
  "Życiowa": ["kiedy-kto-bliski-ga-nie-mini", "3-pierwsze-ruchy", "minutnik-ciszy"],
  Mentalna: ["3-pierwsze-ruchy", "minutnik-ciszy", "podcast-exmortis"],
  Duchowa: ["3-pierwsze-ruchy", "podcast-exmortis", "muzyka-powrotu"],
};
const FREE_DEFAULT = ["3-pierwsze-ruchy", "minutnik-ciszy", "podcast-exmortis"];

export function offerFor(dims, stage, deep) {
  const top = Math.max(0, ...(dims || []).map((d) => Number(d.score) || 0));
  if (deep || top < 4) return null;
  if (top >= 8 && (stage === "Próg" || stage === "Powrót")) return OFFER.powrot;
  return OFFER.rozmowa;
}

export function nextSteps(products, { dims, stage, dominant, deep }) {
  const list = (products || []).filter((p) => p && p.slug);
  const by = new Map(list.map((p) => [p.slug, p]));
  const isFree = (p) => p.status === "dostępny" && Number(p.price || 0) === 0 && !SKIP_FREE.has(p.slug);
  const pref = (FREE_ORDER[dominant] || FREE_DEFAULT).filter((s) => by.has(s) && isFree(by.get(s)));
  for (const p of list) { if (pref.length >= 3) break; if (isFree(p) && !pref.includes(p.slug)) pref.push(p.slug); }
  const o = offerFor(dims, stage, deep);
  const offer = o && by.has(o) && ["dostępny", "wkrótce"].includes(by.get(o).status) ? by.get(o) : null;
  return {
    main: by.get(MAIN_SLUG) || null,
    free: pref.slice(0, 3).map((s) => by.get(s)),
    offer,
  };
}
