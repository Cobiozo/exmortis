import { LAYOUT_DEFAULT as L } from "../blockTypes";

// Strona /1-listopada — spotkanie „Ze śmierci” (zapis: spotkanie o adresie poniżej).
export const LISTOPAD_EVENT = "ze-smierci-o-powrotach-o-ktorych-swiat-nie-mowi";
export const LISTOPAD_COVER = "https://media.base44.com/images/public/6aa08bc6318b0f886cc3b9a3/6af0c5c2f_generated_image.png";
export const LISTOPAD_OG = "https://media.base44.com/images/public/6aa08bc6318b0f886cc3b9a3/ea6d1f83b_generated_image.png";
export const LISTOPAD_INDEX_FROM = "2026-10-16T00:00:00+02:00";

const b = (id, typ, dane, uklad = {}) => ({ id, typ, widoczny: true, dane, uklad: { ...L, numer: "brak", ...uklad } });

export const LISTOPAD_BLOCKS = [
  b("lis-hero", "hero", { wariant: "standard", etykieta: "1 LISTOPADA · 20:00 · ONLINE", linia1: "Ze śmierci —", linia2: "o powrotach, o których świat nie mówi",
    lead: "Wieczór Wszystkich Świętych. 90 minut o trzech śmierciach i czterech etapach powrotu.",
    przyciski: [{ etykieta: "ZAPISZ SIĘ", link: "#zapis", styl: "zloty", strzalka: true }], dopisek: "Bezpłatnie. Link do spotkania przyjdzie e-mailem.",
    tlo: { url: LISTOPAD_COVER }, przyciemnienie: 55 }),
  b("lis-tekst", "tekst", { etykieta: "O SPOTKANIU", tytul: "Wieczór Wszystkich Świętych",
    tresc: "<p class=\"exm-styl-lead\">Wieczór Wszystkich Świętych. 90 minut o trzech śmierciach i czterech etapach powrotu.</p>" }),
  b("lis-dla-kogo", "karty", { etykieta: "DLA KOGO", tytul: "Dla kogo jest ten wieczór", kolumny: "3", numerowane: true, karty: [
    { tytul: "Śmierć mentalna", opis: "Dla tych, którym wypalenie, lęk albo pustka odebrały siebie." },
    { tytul: "Śmierć duchowa", opis: "Dla tych, którzy stracili sens, wiarę albo kierunek." },
    { tytul: "Śmierć życiowa", opis: "Dla tych, którzy przeszli rozstanie, żałobę albo utratę." }] }, { tlo: "grafit" }),
  b("lis-przebieg", "etapy", { etykieta: "PRZEBIEG WIECZORU", tytul: "Jak będzie wyglądał wieczór", uklad: "pionowy", elementy: [
    { tytul: "Trzy śmierci", opis: "Mentalna, duchowa, życiowa — jak je rozpoznać." },
    { tytul: "Cztery etapy powrotu", opis: "Śmierć · Próg · Powrót · Inny." },
    { tytul: "Pytania", opis: "Czas na Twoje pytania — możesz je zadać już przy zapisie." }] }),
  b("lis-faq", "faq", { etykieta: "PYTANIA", tytul: "Pytania i odpowiedzi", pytania: [
    { pytanie: "Ile kosztuje udział?", odpowiedz: "Udział jest bezpłatny." },
    { pytanie: "Gdzie odbywa się spotkanie?", odpowiedz: "Online. Link do spotkania dostaniesz e-mailem po zapisie, razem z plikiem do kalendarza." },
    { pytanie: "Czy muszę włączać kamerę?", odpowiedz: "Nie. Możesz po prostu słuchać." },
    { pytanie: "Ile trwa spotkanie?", odpowiedz: "Około 90 minut." }] }, { tlo: "grafit" }),
  b("lis-ramka", "ramka", { tytul: "JEŚLI JEST CI BARDZO CIĘŻKO",
    tresc: "<p>To spotkanie nie zastępuje pomocy specjalistycznej. Jeśli myślisz o odebraniu sobie życia, zadzwoń pod <strong>116 123</strong> (Telefon Zaufania dla Dorosłych) lub <strong>112</strong>.</p>" }, { odstep: "maly" }),
  b("lis-zapis", "zapis_spotkanie", { etykieta: "ZAPIS", tytul: "Zapisz się na 1 listopada", spotkanie: LISTOPAD_EVENT }),
];