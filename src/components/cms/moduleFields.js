// Pola treści dla modułów dynamicznych (blok „Moduł dynamiczny”).
// Moduł bez wpisu tutaj ma w panelu tylko wybór modułu; moduł z wpisem pokazuje swoje pola,
// żeby teksty sekcji dały się zmieniać w „Treści stron” bez ruszania kodu.
// Wartości zawsze mają bezpieczne domyślne w komponencie modułu.

const ETYKIETA = { k: "etykieta", label: "Etykieta nad nagłówkiem", typ: "text", max: 40 };
const TYTUL = { k: "tytul", label: "Nagłówek sekcji", typ: "textarea", max: 80 };
const LEAD = { k: "tekst", label: "Wstęp pod nagłówkiem (zwykły tekst)", typ: "textarea", max: 260 };

export const MODULE_FIELDS = {
  krotka_historia: [
    ETYKIETA,
    { k: "zdjecie", label: "Portret (kadr 4:5, kadrowanie wybierasz przy zdjęciu)", typ: "image" },
  ],
  droga_powrotu: [
    ETYKIETA,
    TYTUL,
    { k: "tlo", label: "Zdjęcie tła sekcji (mocno przyciemnione; puste = brak zdjęcia)", typ: "image", noAlt: true },
  ],
  od_czego_zaczac: [ETYKIETA, TYTUL, LEAD],
  spotkania: [ETYKIETA, TYTUL],
  wspolpraca: [ETYKIETA, TYTUL, LEAD],
  zostan_dluzej: [ETYKIETA, TYTUL],
  newsletter: [ETYKIETA],
  kontakt: [ETYKIETA],
  instagram: [ETYKIETA],
  rozdroza: [ETYKIETA],
};