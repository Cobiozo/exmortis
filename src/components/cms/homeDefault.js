import { LAYOUT_DEFAULT } from "./blockTypes";
import { HOME_ROZDROZA_BLOCK } from "./homeRozdroza";

// Strona główna — stan wyjściowy migracji i zapas, gdy strona nie jest jeszcze opublikowana.
// Kolejność (etap 3, wariant B): hero → manifest → trzy śmierci → dla kogo → od czego zacząć
// → krótka historia → droga powrotu → zajawka POWRÓT → spotkania → skarbiec → ROZDROŻA
// → newsletter → kontakt → instagram.
const bare = { ...LAYOUT_DEFAULT, numer: "brak" };
const mod = (id, modul, extra = {}, numer = "auto") => ({ id, typ: "modul", widoczny: true, dane: { modul, ...extra }, uklad: { ...LAYOUT_DEFAULT, numer } });

export const HOME_BLOCKS = [
  { id: "home-hero", typ: "hero", widoczny: true, uklad: { ...bare }, dane: {
    wariant: "znak", etykieta: "", linia1: "EXMORTIS", linia2: "ze śmierci",
    lead: "Wracam z siebie. Uczę wracać.",
    podlead: "Mentoring 1:1 dla osób po ważnej zmianie w życiu, które chcą uporządkować swoją sytuację i wybrać następny krok.",
    przyciski: [
      { etykieta: "ZNAJDŹ SWÓJ PIERWSZY KROK", link: "/test?src=home-hero", styl: "zloty", strzalka: true },
      { etykieta: "POZNAJ MNIE I MOJĄ HISTORIĘ", link: "/o-mnie", styl: "obrys", strzalka: false },
    ],
    podpis_przycisku: "Bezpłatny test autorefleksji · 15 pytań · około 3 minut.",
    dopisek: "",
    tlo: { url: "https://media.base44.com/images/public/6aa08bc6318b0f886cc3b9a3/b1f31269c_generated_f9afed1e.jpg", alt: "" },
    przyciemnienie: 60 } },
  { id: "home-manifest", typ: "linie", widoczny: true, uklad: { ...LAYOUT_DEFAULT, szerokosc: "waska", odstep: "xl" }, dane: {
    etykieta: "MANIFEST", akcent: 5, linie: [
      "Może znasz takie dni: wszystko toczy się dalej, a w Tobie coś zgasło.",
      "Chodzisz, pracujesz, uśmiechasz się — a czujesz coraz mniej.",
      "To nie musi być słabość. Czasem to jedna z trzech śmierci: mentalna, duchowa albo życiowa.",
      "Rzadko mówi się o tym głośno.",
      "exmortis to nie motywacja. To droga powrotu.",
      "Gotowość nie jest warunkiem. Wystarczy pierwszy ruch.",
    ] } },
  { id: "home-deaths", typ: "karty", widoczny: true, uklad: { ...LAYOUT_DEFAULT, tlo: "grafit" }, dane: {
    etykieta: "TRZY ŚMIERCI", tytul: "Trzy\nśmierci", numerowane: true, kolumny: "3",
    intro: "To, co trudno nazwać, łatwiej zrozumieć, kiedy ma imię. Zobacz, co z tego brzmi znajomo.",
    karty: [
      { tytul: "Śmierć mentalna", opis: "Gdy życie toczy się na autopilocie, a dni zlewają się w jedno. W środku cisza, której trudno nadać nazwę." },
      { tytul: "Śmierć duchowa", opis: "Gdy z zewnątrz wszystko działa, a w środku brakuje sensu i odpowiedzi na pytanie „po co?”." },
      { tytul: "Śmierć życiowa", opis: "Gdy rozstanie, żałoba, utrata pracy albo choroba zabierają grunt pod nogami." },
    ] } },
  mod("home-forwhom", "dla_kogo", { etykieta: "DLA KOGO" }),
  mod("home-start", "od_czego_zaczac", { etykieta: "OD CZEGO ZACZĄĆ", tytul: "Trzy sposoby na pierwszy krok" }),
  mod("home-history", "krotka_historia", { etykieta: "KRÓTKA HISTORIA" }),
  mod("home-return", "droga_powrotu", { etykieta: "DROGA POWROTU" }),
  mod("home-powrot", "zajawka_powrot", { etykieta: "POWRÓT" }),
  mod("home-events", "spotkania", { etykieta: "SPOTKANIA" }),
  mod("home-skarbiec", "skarbiec", { etykieta: "SKARBIEC", tytul: "Skarbiec",
    tekst: "<p>W Skarbcu znajdziesz materiały na każdy etap powrotu — od bezpłatnego listu tygodniowego po pracę jeden na jeden przez 4–6 miesięcy.</p>" }),
  HOME_ROZDROZA_BLOCK,
  mod("home-newsletter", "newsletter", { etykieta: "LISTY POWROTU" }),
  mod("home-contact", "kontakt", { etykieta: "KONTAKT" }),
  mod("home-instagram", "instagram", {}, "brak"),
];