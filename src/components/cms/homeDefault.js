import { LAYOUT_DEFAULT } from "./blockTypes";
import { HOME_ROZDROZA_BLOCK } from "./homeRozdroza";

// Strona główna — stan wyjściowy migracji i zapas, gdy strona nie jest jeszcze opublikowana.
// Etap 2 przebudowy (18.11.2026): dziesięć rozdziałów, jedna sekcja = jedno główne wezwanie.
// hero → za exmortis stoi człowiek → rozpoznanie (manifest + trzy śmierci + przejście) → droga
// → pierwszy krok → spotkania → współpraca indywidualna → Listy powrotu → zostań na dłużej
// (ROZDROŻA + podcast/Biblioteka/cisza) → kontakt i Instagram.
// Moduły „dla_kogo”, „zajawka_powrot” i „skarbiec” zostają zarejestrowane (używają ich inne strony),
// ale nie występują już na stronie głównej — ich treść przejmują sekcje „pierwszy krok” i „współpraca”.
const bare = { ...LAYOUT_DEFAULT, numer: "brak" };
const mod = (id, modul, extra = {}, numer = "brak") => ({ id, typ: "modul", widoczny: true, dane: { modul, ...extra }, uklad: { ...LAYOUT_DEFAULT, numer } });

const PORTRET = "https://media.base44.com/images/public/6aa08bc6318b0f886cc3b9a3/480c7c335_702144182_17895011880460401_728690723499574380_n.jpg";
// Tło pierwszego ekranu (wygenerowane 18.11.2026): ciemny górski krajobraz o świcie, jeden złoty prześwit.
const TLO_SZEROKIE = "https://media.base44.com/images/public/6aa08bc6318b0f886cc3b9a3/0a6c73404_generated_image.png";
const TLO_PIONOWE = "https://media.base44.com/images/public/6aa08bc6318b0f886cc3b9a3/5a109cbe4_generated_image.png";

export const HOME_BLOCKS = [
  { id: "home-hero", typ: "hero", widoczny: true, uklad: { ...bare }, dane: {
    wariant: "znak", etykieta: "", linia1: "EXMORTIS", linia2: "ZE ŚMIERCI",
    lead: "Kiedy coś w Tobie zgasło, możesz zacząć wracać.",
    podlead: "Spotkania i mentoring indywidualny dla osób po stracie, wypaleniu lub utracie sensu.",
    autor_podpis: "Dawid — mentor powrotu",
    przyciski: [
      { etykieta: "Poznaj drogę powrotu", link: "#rozpoznanie", styl: "zloty", strzalka: true },
      { etykieta: "Poznaj moją historię", link: "/o-mnie", styl: "obrys", strzalka: false },
    ],
    podpis_przycisku: "",
    dopisek: "",
    tlo: { url: TLO_SZEROKIE, alt: "" },
    tlo_mobile: { url: TLO_PIONOWE, alt: "" },
    przyciemnienie: 72 } },
  mod("home-history", "krotka_historia", { etykieta: "ZA EXMORTIS STOI CZŁOWIEK",
    zdjecie: { url: PORTRET, alt: "Dawid — mentor powrotu", fx: 50, fy: 40 } }),
  { id: "home-manifest", typ: "linie", widoczny: true, uklad: { ...LAYOUT_DEFAULT, szerokosc: "waska", odstep: "xl", kotwica: "rozpoznanie" }, dane: {
    etykieta: "ROZPOZNANIE", akcent: 5, linie: [
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
  { id: "home-rozpoznanie-przejscie", typ: "cta", widoczny: true, uklad: { ...LAYOUT_DEFAULT, tlo: "czern", odstep: "sredni", szerokosc: "standard" }, dane: {
    tytul: "", tekst: "Trzy śmierci to nie diagnozy. To nazwy, które pomagają zacząć rozmowę ze sobą.",
    przyciski: [{ etykieta: "Sprawdź, która śmierć jest Twoja", link: "/test?src=home", styl: "obrys", strzalka: true }] } },
  mod("home-return", "droga_powrotu", { etykieta: "DROGA POWROTU", tytul: "Droga powrotu ma cztery etapy" }),
  mod("home-start", "od_czego_zaczac", { etykieta: "WYBIERZ SWÓJ PIERWSZY KROK", tytul: "Wybierz swój pierwszy krok" }),
  mod("home-events", "spotkania", { etykieta: "SPOTKAJMY SIĘ", tytul: "Spotkajmy się" }),
  { ...mod("home-wspolpraca", "wspolpraca", {
    etykieta: "WSPÓŁPRACA INDYWIDUALNA",
    tytul: "Dwie formy pracy jeden na jeden",
    tekst: "Krótka rozmowa o jednej ważnej sprawie albo dłuższa praca nad całym powrotem. Wybierz to, co jest teraz w Twoim zasięgu.",
  }), uklad: { ...LAYOUT_DEFAULT, numer: "brak", kotwica: "wspolpraca" } },
  mod("home-newsletter", "newsletter", { etykieta: "LISTY POWROTU" }),
  HOME_ROZDROZA_BLOCK,
  mod("home-stay", "zostan_dluzej", { etykieta: "ZOSTAŃ NA DŁUŻEJ", tytul: "Między jednym krokiem a następnym" }),
  mod("home-contact", "kontakt", { etykieta: "BĄDŹMY W KONTAKCIE" }),
  mod("home-instagram", "instagram", { etykieta: "OBSERWUJ · INSTAGRAM" }),
];