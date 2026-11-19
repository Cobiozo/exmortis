import { LAYOUT_DEFAULT as L } from "../blockTypes";

// Strona /o-mnie — etap 7 (18.11.2026). Treść autorska Dawida zostaje (historia, granice, sposób pracy,
// credo); zmienia się układ, kolejność, nagłówki sekcji i etykiety. Zdjęcia: Biblioteka mediów
// (adresy /functions/media?id=…). Odstępy wyłącznie z tokenu --exm-section-y, tła naprzemiennie.
const b = (id, typ, dane, uklad = {}) => ({ id: `about-${id}`, typ, widoczny: true, dane, uklad: { ...L, numer: "brak", odstep: "token", ...uklad } });
const IMG = (id) => `/functions/media?id=${id}`;

const FOTO = {
  portret: { url: IMG("15f971557d5b4b68e8360cdfebf5de75"), alt: "Dawid Kowalczyk — mentor powrotu", fx: 50, fy: 35 },
  zona: { url: IMG("9aa156b7c1615682c44a00ea3fb43c05"), alt: "Dawid z żoną", fx: 50, fy: 40 },
  praca: { url: IMG("5d6b5925ff83d0e867dce577ce67efd4"), alt: "Dawid przy pracy nad EXMORTIS", fx: 50, fy: 45 },
  jezioro: { url: IMG("e55ce62f8144ead1bfe7aa810f4abc96"), alt: "Dawid na jeziorze", fx: 50, fy: 55 },
  ksiazka: { url: IMG("a916c6db7e8db20612dfaab705b2611a"), alt: "Dawid z książką Wracam inny", fx: 50, fy: 45 },
};

export const ABOUT_BLOCKS = [
  // 1. Pierwszy ekran — etykieta, H1, pełne imię i nazwisko, przedstawienie, portret.
  b("hero", "about_hero", {
    etykieta: "O MNIE",
    linia1: "Byłem tam.",
    linia2: "I wróciłem. Inny.",
    imie: "Dawid Kowalczyk · mentor powrotu",
    lead: "Jestem Dawid Kowalczyk. Dziś jestem mężem, ojcem i mentorem powrotu. Pracuję z ludźmi, którzy na zewnątrz dają radę. Chodzą do pracy, płacą rachunki, uśmiechają się, a w środku czują, że coś się skończyło. Znam ten stan z własnego życia, dlatego nie przychodzę z gotowymi odpowiedziami: najpierw słucham, potem pytam.",
    portret: FOTO.portret,
  }),

  // 2. Historia przełomu — cztery rozdziały w wąskiej kolumnie; piosenka „exmortis” po rozdziale o odejściu.
  b("historia", "about_historia", {
    etykieta: "HISTORIA PRZEŁOMU",
    rozdzialy: [
      { tytul: "Trzy lata", tresc: `<p>Przez trzy lata byłem księdzem. Towarzyszyłem ludziom w ważnych i trudnych chwilach ich życia. Potem sam znalazłem się w miejscu, którego nie było na mojej mapie.</p>`,
        zdjecie: { url: "/img/dawid-posluga.jpg", alt: "Dawid podczas posługi kapłańskiej" }, podpis: "WCZEŚNIEJSZE ŻYCIE" },
      { tytul: "Depresja", tresc: `<p>Najpierw przyszła depresja. Długa i cicha, z tych, których z zewnątrz nie widać. W końcu przyszedł moment, w którym wiedziałem, że dłużej tak nie mogę. Wtedy w moim życiu pojawiła się kobieta, która dziś jest moją żoną.</p>` },
      { tytul: "Odejście", tresc: `<p>Odszedłem z kapłaństwa. Straciłem pozycję, pracę i wielu znajomych. Dla części ludzi, z którymi byłem blisko, stałem się kimś w rodzaju trędowatego.</p><p>Chciałem wyjechać. Zmienić nazwisko. Zacząć od zera tam, gdzie nikt mnie nie zna.</p><p>W piosence „exmortis” zapisałem zdanie, które długo w sobie nosiłem:</p><blockquote>„Byłem pewien, że grzebią mnie żywcem… a Ty, w tej ciemności, po prostu mnie zasadziłeś.”</blockquote><p><span class="exm-akcent-zloty">Dziś w tych słowach rozpoznaję własną drogę.</span></p>` },
      { tytul: "Zostałem", tresc: `<p>Zostałem. Dzięki niej. Razem zaczęliśmy porządkować nasze życie. Powoli, bez skrótów.</p>` },
    ],
    piosenka_po: 3,
    piosenka_url: "https://youtu.be/SRBc9PiYhfo",
    piosenka_tytul: "exmortis",
    piosenka_podpis: "Tę historię opowiedziałem w piosence.",
  }),

  // 3. Dziś — mąż i ojciec; pod spodem piosenka „Ocalenie”.
  b("dzis", "about_zdjecie", {
    etykieta: "DZIŚ",
    tytul: "Mąż i ojciec",
    tresc: `<p>Dziś jestem mężem i ojcem.</p><p>Ważną częścią tej drogi była dla mnie wiara. Nie musisz podzielać moich przekonań, żeby znaleźć tu miejsce dla siebie.</p><p>To, co dostałem, chcę przekazywać dalej.</p>`,
    zdjecie: FOTO.zona, strona: "lewo", proporcja: "4:5",
    piosenka_wstep: "O miłości, dzięki której zostałem, opowiadam w piosence „Ocalenie”.",
    piosenka_url: "https://youtu.be/92kTN9ZBipc",
    piosenka_tytul: "Ocalenie",
    piosenka_podpis: "Ocalenie — nasza historia",
  }, { tlo: "surface" }),

  // 4. Jak powstało EXMORTIS — nazwa, znaczenie, własna historia jako źródło ostrożności.
  b("powstanie", "about_zdjecie", {
    etykieta: "POWSTANIE",
    tytul: "Skąd wzięło się\n„exmortis”?",
    tresc: `<p>Nazwa EXMORTIS nawiązuje do łacińskiego <em>mors, mortis</em> — śmierć. Czytam ją: ze śmierci. Nie tej, po której ktoś przynosi kwiaty. Tej, przy której nadal chodzisz do pracy i się uśmiechasz, a w środku nic już nie zostało. Może być mentalna, duchowa albo życiowa.</p><p>Z mojej drogi wyrosło exmortis. Tworzę słowa, muzykę i spotkania dla ludzi, którym trudno odnaleźć się po tym, co przeżyli. Własna historia nauczyła mnie ostrożności wobec prostych odpowiedzi.</p><h2 class="exm-akcent-zloty">Byłem pewien, że stąd nie ma wyjścia.</h2><p><span class="exm-akcent-zloty">Myliłem się.</span></p>`,
    zdjecie: FOTO.praca, strona: "prawo", proporcja: "3:2",
  }),

  // 5. Droga — cztery etapy jako pozioma mapa i zdanie o własnym rytmie.
  // Bez tytułu ze strzałkami (19.11.2026): etapy są niżej, tytuł je tylko powtarzał.
  b("droga", "about_droga", {
    etykieta: "DROGA",
    tytul: "",
    elementy: [
      { tytul: "Śmierć", opis: "Chodziłem do pracy, rozmawiałem z ludźmi, uśmiechałem się. W środku była cisza, której nie umiałem nazwać." },
      { tytul: "Próg", opis: "Przyszedł moment, w którym zobaczyłem, że to, co brałem za koniec, jest progiem. Trzeba było przez niego przejść." },
      { tytul: "Powrót", opis: "Nie zaczął się od wielkiej siły. Zaczął się od jednego małego kroku, który dało się zrobić także następnego dnia." },
      { tytul: "Inny", opis: "Nie wróciłem do tego, kim byłem. Wróciłem jako ktoś inny." },
    ],
    nota: "Tak wyglądała moja droga. Twoja może mieć inny rytm.",
  }, { tlo: "surface" }),

  // 6. Jak pracuję i granice — dwa zwarte rozdziały, karty w dwóch kolumnach.
  b("praca", "about_praca", {
    a_etykieta: "WSPÓŁPRACA",
    a_tytul: "Jak prowadzę",
    a_wstep: `<p>Jestem <strong class="exm-akcent-zloty">mentorem</strong>. Wnoszę własne doświadczenie, uważność i pytania. Pomagam przyjrzeć się temu, co wymaga decyzji, i znaleźć następny krok. Odpowiedzialność za Twoje życie zostaje po Twojej stronie.</p>`,
    a_karty: [
      { tytul: "Pytania, które pomagają zobaczyć więcej", opis: "Więcej słucham, niż mówię. Pytam o to, co pomijasz, co uznajesz za oczywiste i dokąd prowadzą Twoje wybory. Decyzje podejmujesz Ty." },
      { tytul: "Jeden konkretny krok", opis: "Pod koniec spotkania ustalamy, co zrobisz dalej. Krok wynika z rozmowy i da się go zrobić w Twojej codzienności." },
      { tytul: "Praca indywidualna", opis: "POWRÓT trwa od czterech do sześciu miesięcy. Spotykamy się na Zoomie co dwa, trzy tygodnie, na 90 minut." },
      { tytul: "Najpierw rozmowa", opis: "Na początku jest krótkie zgłoszenie, ankieta i bezpłatna rozmowa. O tym, czy zaczynamy, decydujemy razem." },
    ],
    a_zamkniecie_etykieta: "CZEGO UCZĘ",
    a_zamkniecie: `<p>Uczę zatrzymać się przed kolejnym automatycznym „tak”. Nazwać to, co trudno przyznać nawet przed sobą. Odróżnić to, co nadal ma znaczenie, od tego, co trzymamy z przyzwyczajenia albo lęku. Znaleźć krok, za który można wziąć odpowiedzialność.</p><p><strong class="exm-akcent-zloty">Sam nadal się tego uczę.</strong></p>`,
    b_etykieta: "GRANICE",
    b_tytul: "Kim nie jestem?",
    b_karty: [
      { tytul: "Nie jestem coachem motywacyjnym", opis: "Nie obiecuję szybkiej przemiany. W mojej pracy jest miejsce na trudne pytania, namysł i odpowiedzialność za własne decyzje." },
      { tytul: "Nie jestem terapeutą", opis: "Mentoring nie zastępuje psychoterapii, diagnozy ani leczenia. Jeśli temat wykracza poza moją pracę, powiem Ci o tym wprost." },
    ],
    b_nota: "Mentoring, nie terapia.",
  }),

  // 7. Spokojny pas przejścia — zdjęcie na szerokość kontenera i credo.
  b("pas", "about_pas", {
    zdjecie: FOTO.jezioro,
    proporcja: "21:9",
    cytat: "Wracam z siebie. Uczę wracać.",
  }, { tlo: "surface" }),

  // 8. Zakończenie — jeden przycisk główny, jeden drugorzędny, link tekstowy i mały odnośnik do książki.
  b("koniec", "about_koniec", {
    tytul: "Nie musisz mieć\njeszcze odpowiedzi.",
    tresc: "<p>Jeśli odnajdujesz w tej historii coś bliskiego, możesz zacząć od jednego kroku: zapisać się na Listy powrotu, wziąć udział w otwartym spotkaniu albo napisać do mnie. Nie musisz opowiadać wszystkiego. Na początek wystarczy to, z czym dziś przychodzisz.</p><p>Jeśli myślisz o pracy indywidualnej, zobacz, jak wygląda program POWRÓT, albo umów jednorazową Rozmowę na progu.</p>",
    przyciski: [
      { etykieta: "Poznaj program POWRÓT", link: "/powrot?src=o-mnie", styl: "zloty", strzalka: true },
      { etykieta: "Weź udział w spotkaniu", link: "/spotkania?src=o-mnie", styl: "obrys", strzalka: false },
      { etykieta: "Umów Rozmowę na progu", link: "/skarbiec/rozmowa-na-progu?src=o-mnie", styl: "obrys", strzalka: false },
    ],
    link_etykieta: "",
    link: "",
    ksiazka_zdjecie: FOTO.ksiazka,
    ksiazka_tytul: "Wracam inny",
    ksiazka_opis: "Zobacz książkę",
    ksiazka_link: "/skarbiec/wracam-inny?src=o-mnie",
  }),
];