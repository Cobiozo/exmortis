import { LAYOUT_DEFAULT as L } from "../blockTypes";
import { HOME_BLOCKS } from "../homeDefault";
import { ABOUT_BLOCKS } from "./aboutDefault";
import { POWROT_BLOCKS, TEST_BLOCKS } from "./powrotDefault";
import { SPOTKANIA_BLOCKS, SKLEP_BLOCKS, SPOTKANIE_TPL, PRODUKT_TPL, ODCINEK_TPL } from "./listingDefaults";

const bare = { ...L, numer: "brak" };
const mod = (id, modul) => ({ id, typ: "modul", widoczny: true, dane: { modul }, uklad: { ...bare } });

export const GLOS_BLOCKS = [
  { id: "glos-hero", typ: "hero", widoczny: true, uklad: { ...bare }, dane: { wariant: "standard", etykieta: "GŁOS", linia1: "Głos", linia2: "exmortis",
    lead: "Muzyka powrotu i podcasty o drodze tam i z powrotem. Słuchaj tam, gdzie jesteś.", przyciski: [], przyciemnienie: 60 } },
  mod("glos-muzyka", "muzyka"), mod("glos-podcast", "podcast"), mod("glos-gosc", "podcast_gosc"),
];

export const KONTAKT_BLOCKS = [
  { id: "kontakt-hero", typ: "hero", widoczny: true, uklad: { ...bare }, dane: { wariant: "standard", etykieta: "KONTAKT", linia1: "Kontakt", linia2: "",
    lead: "Napisz. Odpowiadam osobiście.", przyciski: [], przyciemnienie: 60 } },
  mod("kontakt-formularz", "kontakt_strona"),
];

// Treść wyjściowa stron przenoszonych do edytora (zanim admin coś opublikuje).
export const PAGE_DEFAULTS = { home: HOME_BLOCKS, "o-mnie": ABOUT_BLOCKS, glos: GLOS_BLOCKS, kontakt: KONTAKT_BLOCKS, powrot: POWROT_BLOCKS, test: TEST_BLOCKS, spotkania: SPOTKANIA_BLOCKS, sklep: SKLEP_BLOCKS, _spotkanie: SPOTKANIE_TPL, _produkt: PRODUKT_TPL, _odcinek: ODCINEK_TPL };