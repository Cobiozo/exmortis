// Sekcja ROZDROŻA trafia na stronę główną KODEM, a nie rekordem CMS —
// dzięki temu pojawia się dopiero po wdrożeniu nowej paczki (rekord PublishedPage „home" zostaje nietknięty).
// Jeśli administrator doda gdziekolwiek blok modułu „rozdroza", wstrzyknięcie samo się wyłącza (bez duplikatu).

export const HOME_ROZDROZA_BLOCK = {
  id: "home-rozdroza",
  typ: "modul",
  widoczny: true,
  dane: { modul: "rozdroza" },
  uklad: { szerokosc: "standard", wyrownanie: "lewo", tlo: "czern", odstep: "duzy", numer: "brak", urzadzenia: "wszedzie" },
};

const isRozdroza = (b) => b.id === "home-rozdroza" || (b.typ === "modul" && b.dane?.modul === "rozdroza");

// Wstawia sekcję zaraz PO „Drodze powrotu" (home-return), a gdyby jej nie było — przed „POWRÓT" (home-powrot).
export function withRozdroza(blocks) {
  if (!Array.isArray(blocks) || blocks.some(isRozdroza)) return blocks;
  const after = blocks.findIndex((b) => b.id === "home-return" || (b.typ === "modul" && b.dane?.modul === "droga_powrotu"));
  if (after >= 0) return [...blocks.slice(0, after + 1), HOME_ROZDROZA_BLOCK, ...blocks.slice(after + 1)];
  const before = blocks.findIndex((b) => b.id === "home-powrot" || (b.typ === "modul" && b.dane?.modul === "zajawka_powrot"));
  if (before >= 0) return [...blocks.slice(0, before), HOME_ROZDROZA_BLOCK, ...blocks.slice(before)];
  return blocks;
}