import { LAYOUT_DEFAULT } from "./blockTypes";

// Strona główna przeniesiona do bloków 1:1 (te same teksty, kolejność i wygląd).
// Używana jako stan wyjściowy migracji i zapas, gdy strona nie jest jeszcze opublikowana.
const bare = { ...LAYOUT_DEFAULT, numer: "brak" };
const mod = (id, modul, extra = {}) => ({ id, typ: "modul", widoczny: true, dane: { modul, ...extra }, uklad: { ...bare } });

export const HOME_BLOCKS = [
  { id: "home-hero", typ: "hero", widoczny: true, uklad: { ...bare }, dane: {
    wariant: "znak", etykieta: "", linia1: "EXMORTIS", linia2: "ze śmierci",
    lead: "Wracam z siebie. Uczę wracać.", podlead: "Droga powrotu ze śmierci mentalnej, duchowej i życiowej.",
    przyciski: [
      { etykieta: "Która śmierć jest Twoja?", link: "/test?src=home-hero", styl: "zloty", strzalka: true },
      { etykieta: "KIM JEST EXMORTIS?", link: "#historia", styl: "obrys" },
    ],
    dopisek: "TEST · 5 MINUT · BEZPŁATNIE",
    tlo: { url: "https://media.base44.com/images/public/6aa08bc6318b0f886cc3b9a3/b1f31269c_generated_f9afed1e.jpg", alt: "" },
    przyciemnienie: 60 } },
  { id: "home-manifest", typ: "linie", widoczny: true, uklad: { ...LAYOUT_DEFAULT, szerokosc: "waska", odstep: "xl" }, dane: {
    etykieta: "MANIFEST", akcent: 5, linie: [
      "Są dni, kiedy człowiek żyje, ale w środku już umarł.",
      "Chodzi, pracuje, uśmiecha się — a nie czuje nic.",
      "To nie słabość. To śmierć: mentalna, duchowa, życiowa.",
      "I nikt o niej głośno nie mówi.",
      "exmortis to nie motywacja. To droga powrotu.",
      "Gotowość nie jest warunkiem. Wystarczy pierwszy ruch.",
    ] } },
  { id: "home-deaths", typ: "karty", widoczny: true, uklad: { ...LAYOUT_DEFAULT, tlo: "grafit" }, dane: {
    etykieta: "TRZY ŚMIERCI", tytul: "Trzy\nśmierci", numerowane: true, kolumny: "3",
    intro: "Nie nazywają tego głośno. A ma imię. Zanim zaczniesz wracać, musisz wiedzieć, z czego wracasz.",
    karty: [
      { tytul: "Śmierć mentalna", opis: "Żyjesz na autopilocie i nic nie czujesz. Dni się powtarzają, a w środku jest cisza, której nie umiesz nazwać." },
      { tytul: "Śmierć duchowa", opis: "Tracisz sens i nie wiesz, po co to wszystko. Wszystko działa, ale nic nie rezonuje." },
      { tytul: "Śmierć życiowa", opis: "Rozstanie, żałoba, bankructwo albo choroba zabrały Ci grunt pod nogami." },
    ] } },
  mod("home-forwhom", "dla_kogo"),
  mod("home-history", "krotka_historia"),
  mod("home-return", "droga_powrotu"),
  mod("home-powrot", "zajawka_powrot"),
  mod("home-events", "spotkania"),
  { ...mod("home-skarbiec", "skarbiec", { etykieta: "SKARBIEC", tytul: "Skarbiec",
    tekst: "<p>Powrót ma cztery etapy: <strong>Śmierć · Próg · Powrót · Inny</strong>.</p><p>Na każdym z nich potrzeba innych narzędzi. Innych słów. Innej głębokości pracy.</p><p>W Skarbcu znajdziesz to, co pasuje do miejsca, w którym stoisz dzisiaj — od bezpłatnego listu tygodniowego po pracę jeden na jeden przez sześć miesięcy.</p>" }),
    uklad: { ...bare, numer: "wlasny", numer_wlasny: "08" } },
  mod("home-newsletter", "newsletter"),
  mod("home-contact", "kontakt"),
  mod("home-instagram", "instagram"),
];