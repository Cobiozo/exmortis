import { LAYOUT_DEFAULT as L } from "../blockTypes";

// „O mnie” przeniesione do bloków (te same teksty i zdjęcia co dotąd).
const IMG = "https://media.base44.com/images/public/6aa08bc6318b0f886cc3b9a3/";
const b = (id, typ, dane, uklad = {}) => ({ id: `about-${id}`, typ, widoczny: true, dane, uklad: { ...L, numer: "brak", ...uklad } });

export const ABOUT_BLOCKS = [
  b("hero", "hero", { wariant: "standard", etykieta: "O MNIE", linia1: "Byłem tam.", linia2: "I wróciłem. Inny.",
    lead: "Były ksiądz. Dziś mąż, ojciec i mentor powrotu. exmortis to przestrzeń dla ludzi, którzy chcą przebić się przez swoje dno — i zamiast pogrzebu przeżyć zasadzenie.",
    przyciski: [], przyciemnienie: 60 }),
  b("historia", "tekst_zdjecie", { etykieta: "KRÓTKA HISTORIA", tytul: "", strona: "prawo", proporcja: "4:5", mobile: "gora",
    podpis: "POSŁUGA · WCZEŚNIEJSZE ŻYCIE", przyciski: [], zdjecie: { url: `${IMG}29c863d5e_Gemini_Generated_Image_5hhwtq5hhwtq5hhw.jpeg`, alt: "Dawid — posługa kapłańska" },
    tresc: `<p>Byłem księdzem. Prowadziłem ludzi.</p><p>A potem sam znalazłem się w miejscu, którego nie było na mapie. W odrzuceniu, w „trędowatości”, w braku perspektyw.</p><p>Nie zaczynałem od dna. Do dna jeszcze pukałem od spodu.</p><p><strong class="exm-akcent-zloty">Byłem niżej.</strong></p><p>W piosence „exmortis” zapisałem zdanie, które długo w sobie nosiłem:</p><blockquote>„Byłem pewien, że grzebią mnie żywcem… a Ty, w tej ciemności, po prostu mnie zasadziłeś.”</blockquote><p><span class="exm-akcent-zloty">To cała moja historia w jednym zdaniu. Reszta to konsekwencje.</span></p>` }, { tlo: "grafit" }),
  b("piosenka", "wideo", { etykieta: "POSŁUCHAJ · EXMORTIS", tytul: "Całą tę historię opowiedziałem w piosence.", url: "https://youtu.be/SRBc9PiYhfo", proporcja: "16:9" }),
  b("powrot", "tekst_zdjecie", { etykieta: "PRÓG", tytul: "Powrót nie przyszedł od razu.", strona: "lewo", proporcja: "4:5", mobile: "gora", przyciski: [],
    zdjecie: { url: `${IMG}f7f7a5e2f_474783848_18188957653314489_4657498483259380055_n.jpg`, alt: "Dawid — exmortis" },
    tresc: `<p>Najpierw była depresja. Cicha, długa — taka, której z zewnątrz nie widać.</p><p>Potem decyzja, że dłużej tak nie mogę. I wtedy pojawiła się ona — kobieta, która dziś jest moją żoną. Moje życie obróciło się o 180 stopni.</p><p>Ale to jeszcze nie był powrót.</p><p>Odszedłem z kapłaństwa i zostałem z niczym. Straciłem pozycję, pracę, znajomych. Dla wielu, z którymi szedłem przez lata, stałem się trędowaty.</p><p>Chciałem wyjechać. Zmienić nazwisko. Zacząć od zera tam, gdzie nikt mnie nie zna.</p><p><strong>Zostałem. Dzięki niej.</strong></p><p>Razem zawalczyliśmy o ułożenie życia — przede wszystkim o powrót do komunii z Bogiem. Krok po kroku, bez skrótów.</p><p>Zostałem przeniesiony do stanu świeckiego. Choć wiem, że kapłaństwo zostawia znamię, którego nic nie zmaże: „Ty jesteś kapłanem na wieki”.</p><p>Moja żona otrzymała stwierdzenie nieważności wcześniejszego małżeństwa. Stanęliśmy razem przed ołtarzem i zawarliśmy sakramentalne małżeństwo. Wszystko, co było rozdarte, zostało uporządkowane.</p><p>Dziś jestem szczęśliwym mężem i ojcem. Rosnę w komunii z Bogiem. I tę iskrę chcę dawać dalej — zamieniać „grzebanie” w „sadzenie”.</p>` }),
  b("ocalenie-cytat", "cytat", { tekst: "Moim ocaleniem jest moja żona. Posłuchaj naszej historii w piosence „Ocalenie”.", podpis: "" }, { wyrownanie: "srodek", szerokosc: "waska", odstep: "maly" }),
  b("ocalenie", "wideo", { url: "https://youtu.be/92kTN9ZBipc", proporcja: "16:9", podpis: "Ocalenie — nasza historia" }, { odstep: "sredni" }),
  b("powstanie", "tekst", { etykieta: "POWSTANIE", tytul: "Skąd wzięło się\n„exmortis”?",
    tresc: `<p>I tak powstała przestrzeń exmortis — ze śmierci. Miejsce dla ludzi, którzy wychodzą: z tego, co ich zabijało po cichu. Z siebie sprzed lat. Ze śmierci mentalnej, duchowej albo życiowej. Do siebie. Do wzrostu.</p><h2 class="exm-akcent-zloty">Nie ma sytuacji bez wyjścia.</h2><p><span class="exm-akcent-zloty">Wiem to. Byłem tam, gdzie wydawało mi się, że jest.</span></p>` }, { szerokosc: "waska", odstep: "xl" }),
  b("granice", "karty", { etykieta: "GRANICE", tytul: "Kim NIE\njestem?", numerowane: true, kolumny: "3", karty: [
    { tytul: "Nie jestem coachem", opis: "Nie sprzedaję sukcesu ani Lamborghini w miesiąc. Nie robię „10 sposobów na cokolwiek”." },
    { tytul: "Nie jestem terapeutą", opis: "Jeśli jesteś w klinicznym kryzysie — najpierw specjalista, potem ja. Powiem Ci to na rozmowie kwalifikacyjnej i jeśli trzeba, wskażę kierunek." },
    { tytul: "Nie jestem już księdzem", opis: "Ale to, co zrozumiałem dzięki studiom, posłudze kapłańskiej — o człowieku, o głębi, o ciszy, o towarzyszeniu drugiemu przez próg — zostało. I stało się fundamentem tego, co robię teraz." },
  ] }, { tlo: "grafit" }),
  b("mentor", "tekst_zdjecie", { etykieta: "", tytul: "", strona: "lewo", proporcja: "4:5", mobile: "gora", podpis: "MENTOR · KOMPAS", przyciski: [],
    zdjecie: { url: `${IMG}76a96cdf4_686174507_17893800810460401_1310148896120990981_n.jpg`, alt: "Dawid — exmortis" },
    tresc: `<p>Jestem <strong class="exm-akcent-zloty">mentorem</strong>. Czyli człowiekiem, który idzie kawałek obok Ciebie, bo szedł tą drogą wcześniej. Nie mam mapy Twojego życia. Zostawiam kompas, nie kierunek.</p>` }, { tlo: "grafit", odstep: "maly" }),
  b("ucze", "tekst", { etykieta: "CZEGO UCZĘ", tytul: "Czego uczę?", tresc: "<p>Uczę tego, czego sam się nauczyłem — płacąc pełną cenę.</p>" }, { szerokosc: "waska", odstep: "sredni" }),
  b("ucze-lista", "linie", { etykieta: "", akcent: 0, linie: [
    "Że powrót jest możliwy. Z każdej z trzech śmierci.",
    "Że nowa wersja Ciebie nie powstanie z tej samej gliny, co poprzednia. Trzeba ją wypalić.",
    "Że cisza jest formą przywództwa nad sobą.",
    "Że odrzucenie nie jest końcem — czasem jest jedynym warunkiem, żeby coś w Tobie mogło zacząć rosnąć naprawdę.",
    "Że pieniądze, sukces, uznanie są efektem dojrzałości, nie odwrotnie.",
    "Że ludzie idą za kimś, kto wrócił. Nie za kimś, kto nigdy nie upadł.",
  ] }, { szerokosc: "waska", odstep: "sredni" }),
  b("droga", "etapy", { etykieta: "DROGA", tytul: "Śmierć → Próg →\nPowrót → Inny", uklad: "pionowy", elementy: [
    { tytul: "Śmierć", opis: "Chodziłem, pracowałem, uśmiechałem się — a w środku była cisza, której nie umiałem nazwać. Żyłem na autopilocie." },
    { tytul: "Próg", opis: "Moment, w którym zrozumiałem: to, co uważałem za koniec, jest progiem. Trzeba było przez niego przejść." },
    { tytul: "Powrót", opis: "Powrót nie zaczyna się od siły. Zaczyna się od jednego ruchu. Małego. Wykonalnego. Powtórzonego jutro." },
    { tytul: "Inny", opis: "Wracam nie do tego, kim byłem. Wracam jako ktoś nowy. I uczę wracać innych." },
  ] }),
  b("postawa", "karty", { etykieta: "POSTAWA", tytul: "Jak\nprowadzę", numerowane: true, kolumny: "3", karty: [
    { tytul: "Pytania zamiast rad", opis: "Nie mówię «zrób tak» — to Twoje życie, więc ostateczne decyzje podejmujesz Ty. Moim zadaniem jest poprzez zadawanie pytań pokazać różne perspektywy. Więcej słucham niż mówię." },
    { tytul: "Jeden ruch na sesję", opis: "Każde spotkanie kończy się jednym konkretnym ruchem do wykonania. Bo powrót to ruchy, nie plany na rok." },
  ] }, { tlo: "grafit" }),
  b("cta-foto", "zdjecie", { zdjecie: { url: `${IMG}480c7c335_702144182_17895011880460401_728690723499574380_n.jpg`, alt: "Dawid — exmortis" }, proporcja: "1:1" }, { szerokosc: "waska", odstep: "maly" }),
  b("cta", "tekst", { etykieta: "", tytul: "Jeśli coś w Tobie\njuż wie",
    tresc: "<p>Że chodzisz i pracujesz, a w środku jest cisza — to znaczy, że już wracasz. Zrób pierwszy ruch.</p>" }, { wyrownanie: "srodek", szerokosc: "waska", odstep: "maly" }),
  b("cta-przyciski", "przyciski", { przyciski: [
    { etykieta: "ZOBACZ DROGĘ POWROTU", link: "/skarbiec", styl: "zloty", strzalka: true },
    { etykieta: "NAPISZ DO MNIE", link: "/kontakt", styl: "obrys", strzalka: true },
  ] }, { wyrownanie: "srodek", odstep: "sredni" }),
];