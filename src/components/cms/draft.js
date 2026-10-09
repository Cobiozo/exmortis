// Treść do uzupełnienia: „TWÓJ FRAGMENT” — ukryta publicznie, w panelu widoczna z ostrzeżeniem.
export const DRAFT = "TWÓJ FRAGMENT";
export const isDraft = (v) => JSON.stringify(v ?? "").includes(DRAFT);