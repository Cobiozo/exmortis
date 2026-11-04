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

// Wstawia sekcję zaraz PO bloku Skarbca (home-skarbiec).
function addRozdroza(blocks) {
  if (!Array.isArray(blocks) || blocks.some(isRozdroza)) return blocks;
  const after = blocks.findIndex((b) => b.id === "home-skarbiec" || (b.typ === "modul" && b.dane?.modul === "skarbiec"));
  if (after < 0) return blocks;
  return [...blocks.slice(0, after + 1), HOME_ROZDROZA_BLOCK, ...blocks.slice(after + 1)];
}

// Zapowiedź OBOK — tak samo kodem, zaraz PO ROZDROŻACH (bez duplikatu, gdy admin doda blok „obok”).
export const HOME_OBOK_BLOCK = {
  id: "home-obok",
  typ: "modul",
  widoczny: true,
  dane: { modul: "obok" },
  uklad: { szerokosc: "standard", wyrownanie: "lewo", tlo: "czern", odstep: "duzy", numer: "brak", urzadzenia: "wszedzie" },
};
const isObok = (b) => b.id === "home-obok" || (b.typ === "modul" && b.dane?.modul === "obok");

function addObok(blocks) {
  if (!Array.isArray(blocks) || blocks.some(isObok)) return blocks;
  const after = blocks.findIndex(isRozdroza);
  if (after < 0) return blocks;
  return [...blocks.slice(0, after + 1), HOME_OBOK_BLOCK, ...blocks.slice(after + 1)];
}

export function withRozdroza(blocks) {
  return addObok(addRozdroza(blocks));
}