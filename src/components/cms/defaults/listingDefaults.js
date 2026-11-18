import { LAYOUT_DEFAULT as L } from "../blockTypes";

// Szablony stron z listami: nagłówek i teksty w blokach, dane z modułów.
const b = (id, typ, dane, uklad = {}) => ({ id, typ, widoczny: true, dane, uklad: { ...L, numer: "brak", ...uklad } });

export const SPOTKANIA_BLOCKS = [
  b("spotkania-hero", "hero", { wariant: "standard", rozmiar: "kompakt", etykieta: "SPOTKANIA", linia1: "Spotkajmy się na żywo", linia2: "",
    lead: "Otwarte wieczory, warsztaty i kręgi — online i na żywo. Zapisz się i przyjdź tak, jak jesteś.", przyciski: [], przyciemnienie: 60 }),
  b("spotkania-lista", "modul", { modul: "spotkania_lista" }),
];

// Szablony pojedynczych stron: treść z modułu, nad i pod nią dowolne bloki.
export const SPOTKANIE_TPL = [b("tpl-spotkanie", "modul", { modul: "spotkanie_tresc" })];
export const ODCINEK_TPL = [b("tpl-odcinek", "modul", { modul: "odcinek_tresc" })];
export const PRODUKT_TPL = [b("tpl-produkt", "modul", { modul: "produkt_tresc" })];

// Skarbiec (etap 4): krótki nagłówek i jeden katalog z zakładkami grup. Wskazówka o teście
// siedzi w module katalogu (mały link, nie baner) — tak jak ustalono w przebudowie.
export const SKLEP_BLOCKS = [
  b("sklep-hero", "hero", { wariant: "standard", etykieta: "SKARBIEC", linia1: "Wybierz swój pierwszy krok", linia2: "",
    lead: "Od bezpłatnych materiałów po pracę jeden na jeden — wybierz to, co pasuje do miejsca, w którym jesteś.",
    przyciski: [], przyciemnienie: 60 }),
  b("sklep-katalog", "modul", { modul: "skarbiec_katalog" }),
];