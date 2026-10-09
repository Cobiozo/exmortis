import { LAYOUT_DEFAULT as L } from "../blockTypes";

// POWRÓT przeniesiony do bloków (te same teksty co dotąd).
const b = (id, typ, dane, uklad = {}) => ({ id: `powrot-${id}`, typ, widoczny: true, dane, uklad: { ...L, numer: "brak", ...uklad } });
const ul = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
const G = "grafit";

export const POWROT_BLOCKS = [
  b("hero", "hero", { wariant: "standard", etykieta: "AUTORSKI PROGRAM MENTORSKI EXMORTIS", linia1: "", linia2: "POWRÓT",
    lead: "4–6 miesięcy. Osiem sesji. Jedna decyzja: „chcę wrócić inny.”", przyciski: [{ etykieta: "WYPEŁNIJ ZGŁOSZENIE", link: "#formularz", styl: "zloty", strzalka: true }], przyciemnienie: 60 }),
  b("otwarcie", "tekst", { etykieta: "OTWARCIE · 01", tytul: "Są ludzie, którzy przychodzą do mnie, bo coś w nich umarło.",
    tresc: `<p class="exm-styl-lead">Nie mówią tego wprost. Mówią, że są zmęczeni, stracili sens, nie poznają siebie — mają wszystko, na co pracowali, i jednocześnie nic nie czują. Zwłaszcza szczęścia, satysfakcji, radości z życia.</p><p class="exm-styl-lead">Umarli. Tylko jeszcze o tym nie wiedzą.</p><h2 class="exm-akcent-zloty">POWRÓT jest dla tych, którzy już wiedzą.</h2>` }),
  b("dla-kogo", "tekst", { etykieta: "DLA KOGO · 02", tytul: "To praca dla Ciebie, jeśli:",
    tresc: ul(["Wracasz z wypalenia, które nie mija po urlopie", "Wracasz z kryzysu, który zdarł Ci maskę", "Wracasz z rozstania, które zabrało więcej niż osobę", "Wracasz z pozycji, w której się zgubiłeś", "Wracasz z sukcesu, który nie smakuje", "Wracasz z ciszy po stracie", "Wracasz z siebie sprzed kilku lat, do którego nie chcesz już wrócić"])
      + `<h3>Nie musisz wiedzieć, dokąd wracasz.</h3><h3 class="exm-akcent-zloty">Wystarczy, że wiesz, że tak dalej nie chcesz.</h3>` }),
  b("nie-dla", "tekst", { etykieta: "NIE DLA CIEBIE · 03", tytul: "To NIE jest dla Ciebie, jeśli:",
    tresc: ul(["Chcesz szybkiej motywacji na weekend.", "Szukasz kogoś, kto powie Ci, co masz zrobić.", "Chcesz „poczuć się lepiej”, ale nie chcesz nic zmieniać.", "Jesteś w głębokim kryzysie klinicznym — wtedy potrzebujesz terapeuty, nie mentora. Powiem Ci to na rozmowie i jeśli trzeba, wskażę kierunek."]) }, { tlo: G }),
  b("obietnica", "tekst", { etykieta: "OBIETNICA · 04", tytul: "Nie obiecuję Ci, że poczujesz się lepiej.",
    tresc: `<p class="exm-styl-lead">Obiecuję Ci, że zobaczysz perspektywę wyjścia i powrotu do siebie. Inaczej.</p><p class="exm-styl-lead">Możesz wyjść z tego, co Cię zabijało po cichu — bo nie ma sytuacji bez wyjścia — i stanąć na sensie, na którym da się stanąć na dłużej niż tydzień.</p><h2 class="exm-akcent-zloty">Nowa wersja Ciebie nie powstanie z tej samej gliny, co poprzednia. Trzeba ją wypalić. Właśnie tego uczę.</h2>` }),
  b("etapy", "karty", { etykieta: "CZTERY ETAPY · 05", tytul: "Cztery etapy\npowrotu", intro: "Program stoi na czterech etapach. To nie jest teoria — to droga, którą sam przeszedłem.", numerowane: true, kolumny: "2", karty: [
    { tytul: "I · Śmierć", opis: "Nazywamy, co w Tobie umarło. Bez dramatu i bez pocieszania. Prawda jest fundamentem powrotu." },
    { tytul: "II · Próg", opis: "Podejmujesz decyzję. Nie deklarację — decyzję. To sesja, po której nie da się już żyć tak samo." },
    { tytul: "III · Powrót", opis: "Odbudowujemy sens. Wnętrze. Codzienność. Tu dzieje się praca właściwa." },
    { tytul: "IV · Inny", opis: "Kim jesteś teraz. Jak nie wrócić do śmierci. Jak iść dalej, żeby to, co powstało, zostało." },
  ] }, { tlo: G }),
  b("jak", "tekst", { etykieta: "JAK TO WYGLĄDA · 06", tytul: "Jak to wygląda",
    tresc: `<ul><li><strong>Czas pracy:</strong> 4–6 miesięcy</li><li><strong>Sesje:</strong> 8 spotkań · co 2–3 tygodnie</li><li><strong>Długość:</strong> 60 min (sesja 1: do 90 min)</li><li><strong>Miejsce:</strong> Platforma Zoom</li></ul><p>Osiem sesji, cztery etapy. Od diagnozy — gdzie jesteś, co umarło — po plan, żeby nie wrócić do śmierci.</p><p>Między sesjami: zadania szyte pod Ciebie, dziennik powrotu, kontakt ze mną w ustalonych granicach. Nie zostawiam Cię między spotkaniami.</p>` }),
  b("dostajesz", "tekst", { etykieta: "CO DOSTAJESZ · 07", tytul: "Co dostajesz",
    tresc: ul(["Osiem sesji indywidualnych 1:1", "Twoja własna Mapa powrotu (powstaje w sesji pierwszej)", "Arsenał 8 narzędzi głębi — po jednym na każdy etap", "Dziennik powrotu z zadaniami między sesjami", "Kontakt między sesjami (wiadomości, audio — z granicami)", "Domknięcie: osobisty plan „jak nie wrócić do śmierci”", "Dostęp do zamkniętej ścieżki „Listów powrotu” tylko dla uczestników programu"])
      + `<h3>To nie jest kurs, który się kończy.</h3><h3 class="exm-akcent-zloty">To jest praca, która zostaje.</h3>` }, { tlo: G }),
  b("kwalifikacja", "etapy", { etykieta: "KWALIFIKACJA · 08", tytul: "Cztery osoby.\nZero pośpiechu.", uklad: "pionowy", elementy: [
    { tytul: "Zgłoszenie", opis: "Wypełniasz krótkie zgłoszenie (kilka pytań o to, z czego wracasz i czego szukasz)" },
    { tytul: "Rozmowa", opis: "Umawiamy rozmowę kwalifikacyjną — bezpłatnie, bez zobowiązań" },
    { tytul: "Decyzja", opis: "Po rozmowie oboje decydujemy: czy to Twój moment i czy jestem Twoim przewodnikiem" },
    { tytul: "Start", opis: "Jeśli tak — ustalamy termin startu i formę współpracy" },
  ] }),
  b("kwalifikacja-dopisek", "tekst", { tytul: "", tresc: `<p class="exm-styl-maly">Jeśli po rozmowie któreś z nas uzna, że to nie ten moment albo nie ta osoba — rozstajemy się w dobrym. Bez presji z żadnej strony.</p>` }, { odstep: "maly", szerokosc: "waska" }),
  b("faq", "faq", { etykieta: "PYTANIA · 09", tytul: "Pytania", pytania: [
    { pytanie: "Czym to się różni od terapii?", odpowiedz: "Terapia leczy zaburzenie. Mentoring prowadzi przez zmianę. Terapeuta pomaga Ci zrozumieć siebie. Mentor idzie z Tobą przez próg. Jeśli jesteś w klinicznym kryzysie — najpierw terapeuta, potem ja. Jeśli jesteś zdrowy, ale zablokowany — jestem od tego." },
    { pytanie: "Ile trwa jedna sesja?", odpowiedz: "60 minut w rytmie sesji + pierwsza sesja diagnostyczna do 90 minut. Bez pośpiechu. Cisza w środku sesji jest częścią pracy." },
    { pytanie: "Jaka jest inwestycja?", odpowiedz: "2 999 PLN za pełny cykl. Płatność jednorazowo. Nie sprzedaję sesji — sprzedaję drogę." },
    { pytanie: "Co, jeśli w trakcie stwierdzę, że to nie dla mnie?", odpowiedz: "Po trzeciej sesji jest naturalny moment weryfikacji. Jeśli któreś z nas uzna, że to nie ta praca — kończymy, rozliczam się z Tobą za wykonane sesje, reszta wraca do Ciebie. Chronię Twoje pieniądze tak samo jak Twoją drogę." },
    { pytanie: "Czy widujemy się na żywo?", odpowiedz: "Cały program prowadzony jest przez platformę Zoom — po to, żeby był dostępny niezależnie od miasta. Uczestnicy POWRÓT-u mają pierwszeństwo i specjalne warunki w zapisach na doroczny retreat „exmortis” w Bieszczadach." },
    { pytanie: "Jak często rusza nowa kohorta?", odpowiedz: "Nie prowadzę kohort. Program jest indywidualny — startujesz wtedy, kiedy Ty i ja jesteśmy gotowi." },
    { pytanie: "Czy to jest to samo, co Pure Life?", odpowiedz: "Nie. Pure Life to przestrzeń systematycznej pracy nad pięcioma płaszczyznami dojrzałości, prowadzona z zespołem liderów i specjalistów. POWRÓT w Exmortis to indywidualna, głęboka praca ze mną — jeden na jeden. Można korzystać z obu. Można z jednego. Można z żadnego." },
  ] }, { tlo: G }),
  b("ostatnie", "tekst", { etykieta: "OSTATNIE SŁOWO", tytul: "Nie musisz decydować się dziś.",
    tresc: `<p class="exm-styl-lead">Ale jeśli po tym, co przeczytałeś, coś w Tobie mówi „to o mnie” — nie odkładaj tego na kwartał, w którym „będzie lepszy moment”. Powrót nie zaczyna się w lepszym momencie. Powrót zaczyna się od decyzji, żeby przestać czekać.</p>` }, { odstep: "maly" }),
  b("spotkanie", "modul", { modul: "powrot_spotkanie" }),
  b("ostatnie-przyciski", "przyciski", { przyciski: [
    { etykieta: "WYPEŁNIJ FORMULARZ KWALIFIKACYJNY", link: "#formularz", styl: "zloty", strzalka: true },
    { etykieta: "ZOBACZ SKARBIEC — RÓŻNE DROGI POWROTU", link: "/skarbiec", styl: "obrys", strzalka: false },
  ] }, { odstep: "maly" }),
  b("formularz", "modul", { modul: "powrot_formularz" }),
  b("koniec", "cytat", { tekst: "„Wracam z siebie. Uczę wracać.”", podpis: "EXMORTIS — ZE ŚMIERCI" }, { wyrownanie: "srodek", szerokosc: "waska" }),
];

export const TEST_BLOCKS = [
  { id: "test-quiz", typ: "modul", widoczny: true, uklad: { ...L, numer: "brak" }, dane: { modul: "test",
    tytul: "Która śmierć jest Twoja?",
    tekst: "<p>Każdy z nas ma za sobą przynajmniej jedną śmierć — mentalną, duchową albo życiową. Ten test nie jest diagnozą. Jest lustrem. Dwanaście stwierdzeń, trzy minuty, odpowiadaj pierwszą myślą.</p>" } },
];