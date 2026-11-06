import { LAYOUT_DEFAULT as L } from "../blockTypes";

// „O mnie” w blokach. Wersja zaakceptowana przez Dawida 6.11.2026: krótkie zdania, jedna metafora
// (pogrzebanie → zasadzenie), wiara jednym zdaniem (wariant A), granice mentoringu, opis współpracy,
// pierwszy krok bezpłatny (Listy powrotu).
const IMG = "https://media.base44.com/images/public/6aa08bc6318b0f886cc3b9a3/";
const b = (id, typ, dane, uklad = {}) => ({ id: `about-${id}`, typ, widoczny: true, dane, uklad: { ...L, numer: "brak", ...uklad } });

export const ABOUT_BLOCKS = [
  b("hero", "hero", { wariant: "standard", etykieta: "O MNIE", linia1: "Byłem tam.", linia2: "I wróciłem. Inny.",
    lead: "Jestem Dawid. Byłem księdzem katolickim. Dziś jestem mężem, ojcem i mentorem powrotu.",
    przyciski: [], przyciemnienie: 60 }),
  b("dzis", "tekst_zdjecie", { etykieta: "DZIŚ", tytul: "", strona: "prawo", proporcja: "4:5", mobile: "gora",
    podpis: "MENTOR · EXMORTIS", przyciski: [], zdjecie: { url: `${IMG}480c7c335_702144182_17895011880460401_728690723499574380_n.jpg`, alt: "Dawid — exmortis" },
    tresc: `<p>Pracuję z ludźmi, którzy na zewnątrz dają radę. Chodzą do pracy, płacą rachunki, uśmiechają się. A w środku czują, że coś się skończyło.</p><p>Znam ten stan z własnego życia. Dlatego nie przychodzę z gotowymi odpowiedziami. Najpierw słucham, potem pytam.</p>` }, { tlo: "grafit" }),
  b("historia", "tekst_zdjecie", { etykieta: "KRÓTKA HISTORIA", tytul: "", strona: "lewo", proporcja: "4:5", mobile: "gora",
    podpis: "POSŁUGA · WCZEŚNIEJSZE ŻYCIE", przyciski: [], zdjecie: { url: "/img/dawid-posluga.jpg", alt: "Dawid podczas posługi kapłańskiej" },
    tresc: `<p>Byłem księdzem katolickim. Towarzyszyłem ludziom w ważnych i trudnych chwilach ich życia.</p><p>Potem sam znalazłem się w miejscu, którego nie było na mojej mapie.</p><p>Najpierw przyszła depresja. Długa i cicha, z tych, których z zewnątrz nie widać. W końcu przyszedł moment, w którym wiedziałem, że dłużej tak nie mogę. Wtedy w moim życiu pojawiła się kobieta, która dziś jest moją żoną.</p><p>Odszedłem z kapłaństwa. Straciłem pozycję, pracę i wielu znajomych. Dla części ludzi, z którymi byłem blisko, stałem się kimś w rodzaju trędowatego.</p><p>Chciałem wyjechać. Zmienić nazwisko. Zacząć od zera tam, gdzie nikt mnie nie zna.</p><p>W piosence „exmortis” zapisałem zdanie, które długo w sobie nosiłem:</p><blockquote>„Byłem pewien, że grzebią mnie żywcem… a Ty, w tej ciemności, po prostu mnie zasadziłeś.”</blockquote><p><span class="exm-akcent-zloty">Dziś w tych słowach rozpoznaję własną drogę.</span></p>` }),
  b("piosenka", "wideo", { etykieta: "POSŁUCHAJ · EXMORTIS", tytul: "Tę historię opowiedziałem w piosence.", url: "https://youtu.be/SRBc9PiYhfo", proporcja: "16:9" }),
  b("powrot", "tekst_zdjecie", { etykieta: "PRÓG", tytul: "Powrót nie przyszedł od razu.", strona: "prawo", proporcja: "4:5", mobile: "gora", przyciski: [],
    zdjecie: { url: `${IMG}f7f7a5e2f_474783848_18188957653314489_4657498483259380055_n.jpg`, alt: "Dawid — exmortis" },
    tresc: `<p><strong>Zostałem. Dzięki niej.</strong></p><p>Razem zaczęliśmy porządkować nasze życie. Powoli, bez skrótów.</p><p>Ważną częścią tej drogi była dla mnie wiara. Nie musisz podzielać moich przekonań, żeby znaleźć tu miejsce dla siebie.</p><p>Dziś jestem mężem i ojcem. To, co dostałem, chcę przekazywać dalej.</p>` }, { tlo: "grafit" }),
  b("ocalenie-cytat", "cytat", { tekst: "O miłości, dzięki której zostałem, opowiadam w piosence „Ocalenie”.", podpis: "" }, { wyrownanie: "srodek", szerokosc: "waska", odstep: "maly" }),
  b("ocalenie", "wideo", { url: "https://youtu.be/92kTN9ZBipc", proporcja: "16:9", podpis: "Ocalenie — nasza historia" }, { szerokosc: "waska", odstep: "sredni" }),
  b("powstanie", "tekst", { etykieta: "POWSTANIE", tytul: "Skąd wzięło się\n„exmortis”?",
    tresc: `<p>Ex mortis znaczy po łacinie „ze śmierci”. Nie tej, po której ktoś przynosi kwiaty. Tej, przy której nadal chodzisz do pracy i się uśmiechasz, a w środku nic już nie zostało. Może być mentalna, duchowa albo życiowa.</p><p>Z mojej drogi wyrosło exmortis. Tworzę słowa, muzykę i spotkania dla ludzi, którym trudno odnaleźć się po tym, co przeżyli. Własna historia nauczyła mnie ostrożności wobec prostych odpowiedzi.</p><h2 class="exm-akcent-zloty">Byłem pewien, że stąd nie ma wyjścia.</h2><p><span class="exm-akcent-zloty">Myliłem się.</span></p>` }, { szerokosc: "waska", odstep: "xl" }),
  b("granice", "karty", { etykieta: "GRANICE", tytul: "Kim nie\njestem?", numerowane: true, kolumny: "3", karty: [
    { tytul: "Nie jestem coachem motywacyjnym", opis: "Nie obiecuję szybkiej przemiany. W mojej pracy jest miejsce na trudne pytania, namysł i odpowiedzialność za własne decyzje." },
    { tytul: "Nie jestem terapeutą", opis: "Mentoring nie zastępuje psychoterapii, diagnozy ani leczenia. Jeśli temat wykracza poza moją pracę, powiem Ci o tym wprost." },
    { tytul: "Nie pełnię już posługi kapłańskiej", opis: "Studia i posługa ukształtowały mój sposób słuchania i rozumienia człowieka. Dziś korzystam z tego doświadczenia w innej roli." },
  ] }, { tlo: "grafit" }),
  b("droga", "etapy", { etykieta: "DROGA", tytul: "Śmierć → Próg →\nPowrót → Inny", uklad: "pionowy", elementy: [
    { tytul: "Śmierć", opis: "Chodziłem do pracy, rozmawiałem z ludźmi, uśmiechałem się. W środku była cisza, której nie umiałem nazwać." },
    { tytul: "Próg", opis: "Przyszedł moment, w którym zobaczyłem, że to, co brałem za koniec, jest progiem. Trzeba było przez niego przejść." },
    { tytul: "Powrót", opis: "Nie zaczął się od wielkiej siły. Zaczął się od jednego małego kroku, który dało się zrobić także następnego dnia." },
    { tytul: "Inny", opis: "Nie wróciłem do tego, kim byłem. Wróciłem jako ktoś inny." },
  ] }),
  b("droga-rytm", "tekst", { tresc: "<p>Tak wyglądała moja droga. Twoja może mieć inny rytm.</p>" }, { szerokosc: "waska", odstep: "maly" }),
  b("postawa", "karty", { etykieta: "WSPÓŁPRACA", tytul: "Jak\nprowadzę", numerowane: true, kolumny: "2", karty: [
    { tytul: "Pytania, które pomagają zobaczyć więcej", opis: "Więcej słucham, niż mówię. Pytam o to, co pomijasz, co uznajesz za oczywiste i dokąd prowadzą Twoje wybory. Decyzje podejmujesz Ty." },
    { tytul: "Jeden konkretny krok", opis: "Pod koniec spotkania ustalamy, co zrobisz dalej. Krok wynika z rozmowy i da się go zrobić w Twojej codzienności." },
    { tytul: "Praca jeden na jeden", opis: "POWRÓT trwa od czterech do sześciu miesięcy. Spotykamy się na Zoomie co dwa, trzy tygodnie, na 90 minut." },
    { tytul: "Najpierw rozmowa", opis: "Na początku jest krótkie zgłoszenie, ankieta i bezpłatna rozmowa. O tym, czy zaczynamy, decydujemy razem." },
  ] }, { tlo: "grafit" }),
  b("mentor", "tekst", { etykieta: "MENTOR", tytul: "",
    tresc: `<p>Jestem <strong class="exm-akcent-zloty">mentorem</strong>. Wnoszę własne doświadczenie, uważność i pytania. Pomagam przyjrzeć się temu, co wymaga decyzji, i znaleźć następny krok. Odpowiedzialność za Twoje życie zostaje po Twojej stronie.</p>` }, { szerokosc: "waska", odstep: "sredni" }),
  b("ucze", "tekst", { etykieta: "CZEGO UCZĘ", tytul: "Czego uczę?",
    tresc: `<p>Uczę zatrzymać się przed kolejnym automatycznym „tak”. Nazwać to, co trudno przyznać nawet przed sobą. Odróżnić to, co nadal ma znaczenie, od tego, co trzymamy z przyzwyczajenia albo lęku. Znaleźć krok, za który można wziąć odpowiedzialność.</p><p><strong class="exm-akcent-zloty">Sam nadal się tego uczę.</strong></p>` }, { szerokosc: "waska", odstep: "sredni" }),
  b("credo", "cytat", { tekst: "Wracam z siebie. Uczę wracać.", podpis: "" }, { wyrownanie: "srodek", szerokosc: "waska", odstep: "sredni" }),
  b("cta", "tekst_zdjecie", { etykieta: "", tytul: "Nie musisz mieć\njeszcze odpowiedzi.",
    tresc: "<p>Jeśli odnajdujesz w tej historii coś bliskiego, możesz zacząć od jednego kroku: przeczytać list albo napisać do mnie. Nie musisz opowiadać wszystkiego. Na początek wystarczy to, z czym dziś przychodzisz.</p>",
    strona: "lewo", kolumny: "40-60", proporcja: "4:5", mobile: "gora", przyciski: [
      { etykieta: "CZYTAJ LISTY POWROTU", link: "/#listy-powrotu", styl: "zloty", strzalka: true },
      { etykieta: "NAPISZ DO MNIE", link: "/kontakt", styl: "obrys", strzalka: true },
    ],
    zdjecie: { url: `${IMG}76a96cdf4_686174507_17893800810460401_1310148896120990981_n.jpg`, alt: "Dawid — exmortis" } }, { tlo: "grafit", odstep: "maly" }),
];
