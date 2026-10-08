import { LAYOUT_DEFAULT as L } from "../blockTypes";

// Szablony stron z listami: nagłówek i teksty w blokach, dane z modułów.
const b = (id, typ, dane, uklad = {}) => ({ id, typ, widoczny: true, dane, uklad: { ...L, numer: "brak", ...uklad } });

export const SPOTKANIA_BLOCKS = [
  b("spotkania-hero", "hero", { wariant: "standard", etykieta: "SPOTKANIA", linia1: "Spotkania", linia2: "",
    lead: "Czasem trzeba po prostu posiedzieć razem. Tu znajdziesz spotkania otwarte, warsztaty i kręgi.", przyciski: [], przyciemnienie: 60 }),
  b("spotkania-lista", "modul", { modul: "spotkania_lista" }),
];

// Szablony pojedynczych stron: treść z modułu, nad i pod nią dowolne bloki.
export const SPOTKANIE_TPL = [b("tpl-spotkanie", "modul", { modul: "spotkanie_tresc" })];
export const PRODUKT_TPL = [b("tpl-produkt", "modul", { modul: "produkt_tresc" })];

export const SKLEP_BLOCKS = [
  b("sklep-hero", "hero", { wariant: "standard", etykieta: "SKARBIEC", linia1: "Skarbiec —", linia2: "droga powrotu",
    lead: "Powrót ma cztery etapy: Śmierć · Próg · Powrót · Inny.",
    podlead: "Na każdym z nich potrzeba innych narzędzi. Znajdziesz tu to, co pasuje do miejsca, w którym stoisz dzisiaj — od pierwszego, darmowego kroku po pracę jeden na jeden.",
    przyciski: [], przyciemnienie: 60 }),
  b("sklep-test", "tekst", { etykieta: "NIE WIESZ, OD CZEGO ZACZĄĆ?", tytul: "",
    tresc: "<p class=\"exm-styl-lead\">Dwanaście pytań. Trzy minuty. Zobaczysz, z której śmierci dziś wracasz — i od czego warto zacząć.</p>" }, { tlo: "grafit", odstep: "maly" }),
  b("sklep-test-przycisk", "przyciski", { przyciski: [{ etykieta: "ZRÓB TEST", link: "/test", styl: "zloty", strzalka: true }] }, { tlo: "grafit", odstep: "maly" }),
  b("sklep-katalog", "modul", { modul: "skarbiec_katalog" }),
];