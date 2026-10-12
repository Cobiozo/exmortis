import { LAYOUT_DEFAULT as L } from "../blockTypes";

// Strona /1-listopada — spotkanie „Ze śmierci” (zapis: spotkanie o adresie poniżej).
export const LISTOPAD_EVENT = "ze-smierci-o-powrotach-o-ktorych-swiat-nie-mowi";
export const LISTOPAD_COVER = "https://media.base44.com/images/public/6aa08bc6318b0f886cc3b9a3/6af0c5c2f_generated_image.png";
export const LISTOPAD_OG = "https://exmortis.pl/exmortis-og-1-listopada-v2.jpg"; // grafika udostępniania 1200×630 (public/)
// Baner pod nagłówkiem: „Złota Brama” z biblioteki mediów (wersje WebP przez /functions/media).
export const LISTOPAD_BANNER = "/functions/media?id=0c90920dcc1c8fe2c4162b9ac7a8cf3b";
export const LISTOPAD_INDEX_FROM = "2026-10-16T00:00:00+02:00";
// Start zapisów (czas polski): do tej chwili informacja w nagłówku i komunikat zamiast formularza.
export const LISTOPAD_ZAPISY_OD = "2026-10-16T00:00";

const b = (id, typ, dane, uklad = {}) => ({ id, typ, widoczny: true, dane, uklad: { ...L, numer: "brak", ...uklad } });

export const LISTOPAD_BLOCKS = [
  b("lis-hero", "hero", { wariant: "standard", etykieta: "1 LISTOPADA · 20:00 (CZASU PL) · ONLINE", linia1: "Ze śmierci —", linia2: "o powrotach, o których świat nie mówi",
    lead: "Wieczór Wszystkich Świętych. Dwie godziny o trzech śmierciach i czterech etapach powrotu — z czasem na Twoje pytania.",
    przyciski: [{ etykieta: "ZAPISZ SIĘ", link: "#zapis", styl: "zloty", strzalka: true },
      { etykieta: "DOWIEDZ SIĘ WIĘCEJ", link: "#o-spotkaniu", styl: "obrys" }], przyciski_pion: true,
    zapowiedz: "ZAPISY RUSZAJĄ 16 PAŹDZIERNIKA", zapowiedz_do: LISTOPAD_ZAPISY_OD, dopisek: "Bezpłatnie. Link do spotkania przyjdzie e-mailem.",
    tlo: { url: LISTOPAD_COVER }, przyciemnienie: 55 }),
  b("lis-baner", "zdjecie", { zdjecie: { url: LISTOPAD_BANNER, alt: "exmortis — ze śmierci", fx: 50, fy: 42 }, proporcja: "21:9" }, { odstep: "maly" }),
  b("lis-tekst", "tekst", { etykieta: "O SPOTKANIU", tytul: "Wieczór Wszystkich Świętych",
    tresc: "<p>To spotkanie dla tych, w których coś umarło — sens, wiara, dawne życie — i którzy chcą zrozumieć, jak się z tego wraca. Opowiem o trzech śmierciach, przez które przechodzi człowiek, i o czterech etapach powrotu: Śmierć, Próg, Powrót, Inny.</p><p>Bez gotowych recept i bez pośpiechu. Na końcu zostaje czas na Twoje pytania — możesz zadać je już przy zapisie.</p>" }, { kotwica: "o-spotkaniu" }),
  // „Kto prowadzi” — wyłącznie teksty i zdjęcia z zakładki „O mnie”.
  b("lis-kto", "tekst_zdjecie", { etykieta: "KTO PROWADZI", tytul: "Byłem tam. I wróciłem. Inny.", strona: "lewo", kolumny: "40-60", proporcja: "4:5", mobile: "gora",
    podpis: "POSŁUGA · WCZEŚNIEJSZE ŻYCIE",
    zdjecie: { url: "https://media.base44.com/images/public/6aa08bc6318b0f886cc3b9a3/29c863d5e_Gemini_Generated_Image_5hhwtq5hhwtq5hhw.jpeg", alt: "Dawid — posługa kapłańska" },
    tresc: "<p>Nazywam się Dawid. Byłem księdzem. Prowadziłem ludzi.</p><p>A potem sam znalazłem się w miejscu, którego nie było na mapie. W odrzuceniu, w „trędowatości”, w braku perspektyw. Najpierw była depresja — cicha, długa, taka, której z zewnątrz nie widać.</p><p>Odszedłem z kapłaństwa i zostałem z niczym. Straciłem pozycję, pracę, znajomych.</p><blockquote>„Byłem pewien, że grzebią mnie żywcem… a Ty, w tej ciemności, po prostu mnie zasadziłeś.”</blockquote>",
    przyciski: [] }, { tlo: "grafit" }),
  b("lis-kto-dzis", "tekst_zdjecie", { etykieta: "DZIŚ", tytul: "", strona: "prawo", kolumny: "40-60", proporcja: "4:5", mobile: "gora",
    podpis: "MENTOR · KOMPAS",
    zdjecie: { url: "https://media.base44.com/images/public/6aa08bc6318b0f886cc3b9a3/76a96cdf4_686174507_17893800810460401_1310148896120990981_n.jpg", alt: "Dawid — exmortis" },
    tresc: "<p>Wracałem krok po kroku, bez skrótów. Dziś jestem szczęśliwym mężem i ojcem — i mentorem powrotu.</p><p>Nie jestem coachem ani terapeutą. Jestem człowiekiem, który idzie kawałek obok Ciebie, bo szedł tą drogą wcześniej. Zostawiam kompas, nie kierunek.</p><p><strong class=\"exm-akcent-zloty\">Nie ma sytuacji bez wyjścia.</strong> Wiem to. Byłem tam, gdzie wydawało mi się, że jest.</p>",
    przyciski: [{ etykieta: "MOJA HISTORIA", link: "/o-mnie", styl: "obrys", strzalka: true }] }, { odstep: "maly" }),
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
    { pytanie: "Ile trwa spotkanie?", odpowiedz: "Około dwóch godzin: 90 minut spotkania i 30 minut na Twoje pytania." },
    { pytanie: "Na jakiej platformie odbywa się spotkanie?", odpowiedz: "Na Zoomie, w trybie webinaru. Nie musisz zakładać konta w Zoom." },
    { pytanie: "Czy spotkanie będzie nagrywane?", odpowiedz: "Tak. Nagranie będzie dostępne dla zapisanych przez 7 dni." }] }, { tlo: "grafit" }),
  b("lis-ramka", "ramka", { tytul: "JEŚLI JEST CI BARDZO CIĘŻKO",
    tresc: "<p>To spotkanie nie zastępuje pomocy specjalistycznej. Jeśli myślisz o odebraniu sobie życia, zadzwoń pod <strong>116 123</strong> (Telefon Zaufania dla Dorosłych) lub <strong>800 70 2222</strong> (całą dobę, bezpłatnie). W zagrożeniu życia: <strong>112</strong>.</p>", rozmiar: "mala" }, { odstep: "maly" }),
  b("lis-zapis", "zapis_spotkanie", { etykieta: "ZAPIS", tytul: "Zapisz się na 1 listopada", spotkanie: LISTOPAD_EVENT, zapisy_od: LISTOPAD_ZAPISY_OD }),
];