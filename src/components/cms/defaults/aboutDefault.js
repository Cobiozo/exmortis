import { LAYOUT_DEFAULT as L } from "../blockTypes";

// „O mnie” w blokach. Wersja z 6.11.2026 (zaakceptowana przez Dawida): krótsze zdania, jedna metafora
// (pogrzebanie → zasadzenie), granice mentoringu, opis współpracy, pierwszy krok bezpłatny (Listy powrotu).
const IMG = "https://media.base44.com/images/public/6aa08bc6318b0f886cc3b9a3/";
const b = (id, typ, dane, uklad = {}) => ({ id: `about-${id}`, typ, widoczny: true, dane, uklad: { ...L, numer: "brak", ...uklad } });

export const ABOUT_BLOCKS = [
  b("hero", "hero", { wariant: "standard", etykieta: "O MNIE", linia1: "Byłem tam.", linia2: "I wróciłem. Inny.",
    lead: "Jestem Dawid. Byłem księdzem katolickim. Dziś jestem mężem, ojcem i mentorem powrotu.",
    przyciski: [], przyciemnienie: 60 }),
  b("dzis", "tekst_zdjecie", { etykieta: "DZIŚ", tytul: "", strona: "prawo", proporcja: "4:5", mobile: "gora",
    podpis: "MENTOR · KOMPAS", przyciski: [], zdjecie: { url: `${IMG}480c7c335_702144182_17895011880460401_728690723499574380_n.jpg`, alt: "Dawid — exmortis" },
    tresc: `<p>Pracuję z ludźmi, którzy na zewnątrz dają radę. Chodzą do pracy, płacą rachunki, uśmiechają się. A w środku czują, że coś się skończyło.</p><p>Znam ten stan z własnego życia. Dlatego nie przychodzę z gotowymi odpowiedziami. Słucham, pytam i idę kawałek obok, bo podobną drogę przeszedłem wcześniej.</p><p>Nie mam mapy Twojego życia. Mogę dać Ci kompas.</p>` }, { tlo: "grafit" }),
  b("historia", "tekst_zdjecie", { etykieta: "KRÓTKA HISTORIA", tytul: "", strona: "lewo", proporcja: "4:5", mobile: "gora",
    podpis: "POSŁUGA · WCZEŚNIEJSZE ŻYCIE", przyciski: [], zdjecie: { url: "/img/dawid-posluga.jpg", alt: "Dawid podczas posługi kapłańskiej" },
    tresc: `<p>Byłem księdzem katolickim. Towarzyszyłem ludziom w ważnych i trudnych chwilach ich życia.</p><p>Potem sam znalazłem się w miejscu, którego nie było na żadnej mapie.</p><p>Najpierw przyszła depresja. Długa i cicha, z tych, których z zewnątrz nie widać. W końcu nadszedł moment, w którym wiedziałem, że dłużej tak nie mogę. Wtedy w moim życiu pojawiła się kobieta, która dziś jest moją żoną.</p><p>Odszedłem z kapłaństwa i zostałem z niczym. Straciłem pozycję, pracę i wielu znajomych. Dla części ludzi, z którymi byłem blisko, stałem się kimś w rodzaju trędowatego.</p><p>Chciałem wyjechać, zmienić nazwisko i zacząć od zera tam, gdzie nikt mnie nie zna.</p><p>W piosence „exmortis” zapisałem zdanie, które długo w sobie nosiłem:</p><blockquote>„Byłem pewien, że grzebią mnie żywcem… a Ty, w tej ciemności, po prostu mnie zasadziłeś.”</blockquote><p><span class="exm-akcent-zloty">W tym jednym zdaniu mieści się cała moja historia.</span></p>` }),
  b("piosenka", "wideo", { etykieta: "POSŁUCHAJ · EXMORTIS", tytul: "Tę historię opowiedziałem w piosence.", url: "https://youtu.be/SRBc9PiYhfo", proporcja: "16:9" }),
  b("powrot", "tekst_zdjecie", { etykieta: "PRÓG", tytul: "Powrót nie przyszedł od razu.", strona: "prawo", proporcja: "4:5", mobile: "gora", przyciski: [],
    zdjecie: { url: `${IMG}f7f7a5e2f_474783848_18188957653314489_4657498483259380055_n.jpg`, alt: "Dawid — exmortis" },
    tresc: `<p><strong>Zostałem. Dzięki niej.</strong></p><p>Razem zaczęliśmy porządkować nasze życie. Powoli, krok po kroku, bez skrótów.</p><p>Ważną częścią tej drogi była dla mnie wiara. Mówię o tym otwarcie, bo to część mojej historii. Nie musisz jednak podzielać moich przekonań, żeby znaleźć tu miejsce dla siebie.</p><p>Dziś jestem mężem i ojcem. To, co dostałem, chcę przekazywać dalej.</p>` }, { tlo: "grafit" }),
  b("ocalenie-cytat", "cytat", { tekst: "Była przy mnie, kiedy sam nie umiałem zostać. O tym jest piosenka „Ocalenie”.", podpis: "" }, { wyrownanie: "srodek", szerokosc: "waska", odstep: "maly" }),
  b("ocalenie", "wideo", { url: "https://youtu.be/92kTN9ZBipc", proporcja: "16:9", podpis: "Ocalenie — nasza historia" }, { szerokosc: "waska", odstep: "sredni" }),
  b("powstanie", "tekst", { etykieta: "POWSTANIE", tytul: "Skąd wzięło się\n„exmortis”?",
    tresc: `<p>Ex mortis znaczy po łacinie „ze śmierci”. Nie chodzi o śmierć, po której ktoś przynosi kwiaty. Chodzi o tę, przy której nadal chodzisz do pracy i się uśmiechasz, a w środku nic już nie zostało. Może być mentalna, duchowa albo życiowa.</p><p>exmortis to miejsce dla ludzi, którzy próbują z niej wyjść.</p><h2 class="exm-akcent-zloty">Byłem pewien, że stąd nie ma wyjścia.</h2><p><span class="exm-akcent-zloty">Myliłem się.</span></p>` }, { szerokosc: "waska", odstep: "xl" }),
  b("granice", "karty", { etykieta: "GRANICE", tytul: "Kim nie\njestem?", numerowane: true, kolumny: "3", karty: [
    { tytul: "Nie jestem coachem", opis: "Nie obiecuję szybkich efektów ani gotowych recept. Nie motywuję na siłę." },
    { tytul: "Nie jestem terapeutą", opis: "Mentoring nie zastępuje psychoterapii ani leczenia. Jeśli potrzebujesz innego rodzaju wsparcia, powiem Ci o tym wprost." },
    { tytul: "Nie jestem już księdzem", opis: "Zostało jednak to, czego nauczyły mnie studia i posługa: uważność na człowieka, szacunek dla ciszy i towarzyszenie komuś, kto stoi na progu. Na tym opieram swoją pracę." },
  ] }, { tlo: "grafit" }),
  b("droga", "etapy", { etykieta: "DROGA", tytul: "Śmierć → Próg →\nPowrót → Inny", uklad: "pionowy", elementy: [
    { tytul: "Śmierć", opis: "Chodziłem do pracy, rozmawiałem z ludźmi, uśmiechałem się. W środku była cisza, której nie umiałem nazwać." },
    { tytul: "Próg", opis: "Przyszedł moment, w którym zobaczyłem, że to, co brałem za koniec, jest progiem. Trzeba było przez niego przejść." },
    { tytul: "Powrót", opis: "Nie zaczął się od wielkiej siły. Zaczął się od jednego małego kroku, który dało się zrobić także następnego dnia." },
    { tytul: "Inny", opis: "Nie wróciłem do tego, kim byłem. Wróciłem jako ktoś inny." },
  ] }),
  b("droga-rytm", "tekst", { tresc: "<p>Tak wyglądała moja droga. Twoja może mieć inny rytm i inną kolejność.</p>" }, { szerokosc: "waska", odstep: "maly" }),
  b("postawa", "karty", { etykieta: "WSPÓŁPRACA", tytul: "Jak\nprowadzę", numerowane: true, kolumny: "2", karty: [
    { tytul: "Pytania zamiast rad", opis: "Nie mówię Ci, co masz zrobić. To Twoje życie i Twoje decyzje. Zadaję pytania, które pomagają zobaczyć sprawę z innej strony. Więcej słucham, niż mówię." },
    { tytul: "Jeden krok po spotkaniu", opis: "Każda sesja kończy się jednym konkretnym krokiem, który możesz zrobić przed następną rozmową. Zmiana dzieje się w małych ruchach, nie w planach na cały rok." },
    { tytul: "Praca jeden na jeden", opis: "POWRÓT to praca indywidualna. Trwa od czterech do sześciu miesięcy. Spotykamy się na Zoomie co dwa, trzy tygodnie, na 90 minut." },
    { tytul: "Najpierw rozmowa", opis: "Na początku jest krótkie zgłoszenie, ankieta i bezpłatna rozmowa. O tym, czy zaczynamy wspólną pracę, decydujemy razem." },
  ] }, { tlo: "grafit" }),
  b("ucze", "tekst", { etykieta: "CZEGO UCZĘ", tytul: "Czego uczę?", tresc: "<p>Tego, czego sam musiałem się nauczyć.</p>" }, { szerokosc: "waska", odstep: "sredni" }),
  b("ucze-lista", "linie", { etykieta: "", akcent: 0, linie: [
    "Że koniec czegoś bywa początkiem drogi powrotu.",
    "Że nie wraca się do dawnego siebie. Wraca się kimś nowym.",
    "Że cisza jest formą przywództwa nad sobą.",
    "Że odrzucenie nie musi być końcem.",
  ] }, { szerokosc: "waska", odstep: "sredni" }),
  b("credo", "cytat", { tekst: "Wracam z siebie. Uczę wracać.", podpis: "" }, { wyrownanie: "srodek", szerokosc: "waska", odstep: "sredni" }),
  b("cta", "tekst_zdjecie", { etykieta: "", tytul: "Nie musisz mieć\njeszcze odpowiedzi.",
    tresc: "<p>Możesz zacząć od jednego kroku. Przeczytać list, posłuchać nagrania albo napisać do mnie. Wybierz to, na co masz dziś siłę.</p>",
    strona: "lewo", kolumny: "40-60", proporcja: "4:5", mobile: "gora", przyciski: [
      { etykieta: "CZYTAJ LISTY POWROTU", link: "/#listy-powrotu", styl: "zloty", strzalka: true },
      { etykieta: "NAPISZ DO MNIE", link: "/kontakt", styl: "obrys", strzalka: true },
    ],
    zdjecie: { url: `${IMG}76a96cdf4_686174507_17893800810460401_1310148896120990981_n.jpg`, alt: "Dawid — exmortis" } }, { tlo: "grafit", odstep: "maly" }),
];
