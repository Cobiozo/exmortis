import { LAYOUT_DEFAULT as L } from "../blockTypes";
import { POWROT, POWROT_LEAD, POWROT_HOW_ROWS, POWROT_INCLUDES, POWROT_FAQ_PRICE } from "@/lib/powrotOffer";

// POWRÓT przeniesiony do bloków (te same teksty co dotąd).
// Parametry programu (cena, sesje, czas, częstotliwość, długość, forma, start, narzędzia) — wyłącznie z powrotOffer.js.
const b = (id, typ, dane, uklad = {}) => ({ id: `powrot-${id}`, typ, widoczny: true, dane, uklad: { ...L, numer: "brak", ...uklad } });
const ul = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
const META = ul(POWROT_HOW_ROWS.map((r) => `<strong>${r.label}:</strong> ${r.value}`));
const G = "grafit";

export const POWROT_BLOCKS = [
  b("hero", "hero", { wariant: "standard", etykieta: "AUTORSKI PROGRAM MENTORSKI EXMORTIS", linia1: "", linia2: "POWRÓT",
    lead: POWROT_LEAD, przyciski: [{ etykieta: "WYPEŁNIJ ZGŁOSZENIE", link: "#formularz", styl: "zloty", strzalka: true }], przyciemnienie: 60 }),
  b("otwarcie", "tekst", { etykieta: "OTWARCIE · 01", tytul: "Są ludzie, którzy przychodzą do mnie, bo coś w nich umarło.",
    tresc: `<p class="exm-styl-lead">Nie mówią tego wprost. Mówią, że są zmęczeni, stracili sens, nie poznają siebie — mają wszystko, na co pracowali, i jednocześnie nic nie czują. Zwłaszcza szczęścia, satysfakcji, radości z życia.</p><p class="exm-styl-lead">Umarli. Tylko jeszcze o tym nie wiedzą.</p><h2 class="exm-akcent-zloty">POWRÓT jest dla tych, którzy już wiedzą.</h2>` }),
  b("dla-kogo", "tekst", { etykieta: "DLA KOGO · 02", tytul: "To praca dla Ciebie, jeśli:",
    tresc: ul(["Wracasz z wypalenia, które nie mija po urlopie", "Wracasz z kryzysu, który zdarł Ci maskę", "Wracasz z rozstania, które zabrało więcej niż osobę", "Wracasz z pozycji, w której łatwo się zgubić", "Wracasz z sukcesu, który nie smakuje", "Wracasz z ciszy po stracie", "Wracasz z siebie sprzed kilku lat, do którego nie chcesz już wrócić"])
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
    tresc: `${META}<p>Osiem sesji, cztery etapy. Od diagnozy — gdzie jesteś, co umarło — po plan, żeby nie wrócić do śmierci.</p><p>Między sesjami: zadania szyte pod Ciebie, dziennik powrotu, kontakt ze mną w ustalonych granicach. Nie zostawiam Cię między spotkaniami.</p>` }),
  b("dostajesz", "tekst", { etykieta: "CO OTRZYMUJESZ · 07", tytul: "Co otrzymujesz",
    tresc: ul(POWROT_INCLUDES)
      + `<h3>To nie jest kurs, który się kończy.</h3><h3 class="exm-akcent-zloty">To jest praca, która zostaje.</h3>` }, { tlo: G }),
  b("kwalifikacja", "etapy", { etykieta: "KWALIFIKACJA · 08", tytul: "Zero pośpiechu.", uklad: "pionowy", elementy: [
    { tytul: "Zgłoszenie", opis: "Wypełniasz krótkie zgłoszenie (kilka pytań o to, z czego wracasz i czego szukasz)" },
    { tytul: "Rozmowa", opis: "Umawiamy rozmowę kwalifikacyjną — bezpłatnie, bez zobowiązań" },
    { tytul: "Decyzja", opis: "Po rozmowie oboje decydujemy: czy to Twój moment i czy jestem Twoim przewodnikiem" },
    { tytul: "Start", opis: "Jeśli tak — ustalamy termin startu i formę współpracy" },
  ] }),
  b("faq", "faq", { etykieta: "PYTANIA · 09", tytul: "Pytania", pytania: [
    { pytanie: "Czym to się różni od terapii?", odpowiedz: "Terapia leczy zaburzenie. Mentoring prowadzi przez zmianę. Terapeuta pomaga Ci zrozumieć siebie. Mentor idzie z Tobą przez próg. Jeśli jesteś w klinicznym kryzysie — najpierw terapeuta, potem ja. Jeśli jesteś zdrowy, ale zablokowany — jestem od tego." },
    { pytanie: "Ile trwa jedna sesja?", odpowiedz: `Sesja: ${POWROT.length}. Bez pośpiechu. Cisza w środku sesji jest częścią pracy.` },
    { pytanie: "Czy muszę być osobą wierzącą?", odpowiedz: "Nie. Treści i współpraca są dla osób wierzących i niewierzących. Moja droga ma swoje źródło w wierze, ale nie jest warunkiem pracy ze mną — szanuję Twój światopogląd." },
    { pytanie: "Jaka jest cena?", odpowiedz: POWROT_FAQ_PRICE },
    { pytanie: "Co, jeśli w trakcie stwierdzę, że to nie dla mnie?", odpowiedz: "Po trzeciej sesji jest naturalny moment weryfikacji. Jeśli któreś z nas uzna, że to nie ta praca — kończymy, rozliczam się z Tobą za wykonane sesje, reszta wraca do Ciebie. Chronię Twoje pieniądze tak samo jak Twoją drogę." },
    { pytanie: "Czy widujemy się na żywo?", odpowiedz: `Cały program prowadzony jest przez platformę ${POWROT.form} — po to, żeby był dostępny niezależnie od miasta. Uczestnicy POWRÓT-u mają pierwszeństwo i specjalne warunki w zapisach na doroczny retreat „exmortis” w Bieszczadach.` },
    { pytanie: "Jak często rusza nowa kohorta?", odpowiedz: "Nie prowadzę kohort. Program jest indywidualny — startujesz wtedy, kiedy Ty i ja jesteśmy gotowi." },
  ] }, { tlo: G }),
  b("ostatnie", "tekst", { etykieta: "OSTATNIE SŁOWO", tytul: "Nie musisz decydować się dziś.",
    tresc: `<p class="exm-styl-lead">Ale jeśli po tej lekturze coś w Tobie mówi „to o mnie” — nie odkładaj tego na kwartał, w którym „będzie lepszy moment”. Powrót nie zaczyna się w lepszym momencie. Powrót zaczyna się od decyzji, żeby przestać czekać.</p>` }, { odstep: "maly" }),
  b("spotkanie", "modul", { modul: "powrot_spotkanie" }),
  b("ostatnie-przyciski", "przyciski", { przyciski: [
    { etykieta: "WYPEŁNIJ FORMULARZ KWALIFIKACYJNY", link: "#formularz", styl: "zloty", strzalka: true },
    { etykieta: "ZOBACZ SKARBIEC — RÓŻNE DROGI POWROTU", link: "/skarbiec", styl: "obrys", strzalka: false },
  ] }, { odstep: "maly" }),
  b("podsumowanie", "modul", { modul: "powrot_podsumowanie" }),
  b("formularz", "modul", { modul: "powrot_formularz" }),
  b("koniec", "cytat", { tekst: "„Wracam z siebie. Uczę wracać.”", podpis: "EXMORTIS — ZE ŚMIERCI" }, { wyrownanie: "srodek", szerokosc: "waska" }),
];

export const TEST_BLOCKS = [
  { id: "test-quiz", typ: "modul", widoczny: true, uklad: { ...L, numer: "brak" }, dane: { modul: "test",
    tytul: "Która śmierć jest Twoja?",
    tekst: "<p>Można funkcjonować i jednocześnie przestać żyć. Czasem przez wyczerpanie, czasem przez utratę sensu, czasem przez stratę, po której nic nie jest takie jak wcześniej.</p><p>Piętnaście stwierdzeń o ostatnich czterech tygodniach, kilka minut. Na końcu zobaczysz, ile jest w Tobie dziś śmierci mentalnej, duchowej i życiowej — albo że żadna z nich nie dominuje — oraz na którym etapie drogi jesteś. Odpowiadaj szczerze, pierwszą myślą. Nie ma dobrych ani złych odpowiedzi.</p>" } },
];