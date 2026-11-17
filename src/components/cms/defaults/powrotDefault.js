import { LAYOUT_DEFAULT as L } from "../blockTypes";
import { POWROT, POWROT_LEAD, POWROT_HOW_ROWS, POWROT_INCLUDES, POWROT_FAQ_PRICE, POWROT_CONTACT, ROZMOWA_NA_PROGU, ROZMOWA_WSTEPNA, SESJA_KONTROLNA } from "@/lib/powrotOffer";

// Strona /powrot według master promptu POWRÓT v2 (18.11.2026): proces, nie pakiet konsultacji.
// Parametry programu (cena, sesje, czas, kontakt, pojemność, start) — wyłącznie z powrotOffer.js.
const b = (id, typ, dane, uklad = {}) => ({ id: `powrot-${id}`, typ, widoczny: true, dane, uklad: { ...L, numer: "brak", ...uklad } });
const ul = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
const META = ul(POWROT_HOW_ROWS.map((r) => `<strong>${r.label}:</strong> ${r.value}`));
const G = "grafit";
const IMG = "https://media.base44.com/images/public/6aa08bc6318b0f886cc3b9a3/";
const SPOTKANIE = { etykieta: "Przyjdź najpierw na otwarte spotkanie", link: "/spotkania?src=powrot", styl: "obrys", strzalka: false };
const ZGLOS = { etykieta: "Zgłoś się do programu", link: "#formularz", styl: "zloty", strzalka: true };

export const POWROT_BLOCKS = [
  b("hero", "hero", { wariant: "standard", etykieta: "INDYWIDUALNY PROGRAM MENTORINGOWY", linia1: "", linia2: "POWRÓT",
    lead: "Nie musisz wracać do życia, które przestało być Twoje.",
    podlead: POWROT_LEAD,
    przyciski: [ZGLOS, { ...SPOTKANIE, link: "/spotkania?src=powrot-hero" }], przyciemnienie: 60 }),
  b("otwarcie", "tekst", { etykieta: "OTWARCIE · 01", tytul: "Są ludzie, którzy przychodzą do mnie, bo coś w nich umarło.",
    tresc: `<p class="exm-styl-lead">Nie mówią tego wprost. Mówią, że są zmęczeni, stracili sens, nie poznają siebie — mają wszystko, na co pracowali, i jednocześnie nic nie czują. Zwłaszcza szczęścia, satysfakcji, radości z życia.</p><p class="exm-styl-lead">Często dopiero po czasie nazywają to po imieniu: coś w nich umarło.</p><h2 class="exm-akcent-zloty">POWRÓT jest dla tych, którzy są gotowi to nazwać.</h2>` }),
  b("dla-kogo", "tekst", { etykieta: "DLA KOGO · 02", tytul: "To praca dla Ciebie, jeśli:",
    tresc: ul(["Wracasz z wypalenia, które nie mija po urlopie", "Wracasz z kryzysu, który zdarł Ci maskę", "Wracasz z rozstania, które zabrało więcej niż osobę", "Wracasz z pozycji, w której łatwo się zgubić", "Wracasz z sukcesu, który nie smakuje", "Wracasz z ciszy po stracie", "Wracasz z siebie sprzed kilku lat, do którego nie chcesz już wrócić"])
      + `<h3>Nie musisz wiedzieć, dokąd wracasz.</h3><h3 class="exm-akcent-zloty">Wystarczy, że wiesz, że tak dalej nie chcesz.</h3>` }),
  b("nie-dla", "tekst", { etykieta: "NIE DLA CIEBIE · 03", tytul: "To nie jest dla Ciebie, jeśli:",
    tresc: ul(["Szukasz szybkiej motywacji na weekend.", "Szukasz kogoś, kto powie Ci, co masz zrobić.", "Chcesz „poczuć się lepiej”, ale nie chcesz nic zmieniać.", "Potrzebujesz teraz pomocy psychologicznej, psychoterapeutycznej albo psychiatrycznej. Wtedy ona jest pierwsza — powiem Ci to wprost i, jeśli trzeba, wskażę kierunek."])
      + `<p>Mentoring nie jest psychoterapią ani leczeniem. Nie diagnozuję i nie zastępuję pomocy specjalisty.</p>` }, { tlo: G }),
  b("ramka", "ramka", { tytul: "JEŚLI JEST CI BARDZO CIĘŻKO", rozmiar: "mala",
    tresc: "<p>exmortis to mentoring, nie terapia ani pomoc medyczna. Zadzwoń pod <strong>116 123</strong> lub <strong>800 70 2222</strong> (całą dobę, bezpłatnie). W zagrożeniu życia: <strong>112</strong>.</p>" }, { szerokosc: "waska", tlo: G }),
  b("obietnica", "tekst", { etykieta: "BEZ OBIETNIC · 04", tytul: "Nie obiecuję Ci, że poczujesz się lepiej.",
    tresc: `<p class="exm-styl-lead">Nie obiecuję gotowych rozwiązań ani szybkiej ulgi. Moją rolą jest iść obok Ciebie, kiedy szukasz perspektywy i kolejnych kroków.</p><p class="exm-styl-lead">Razem przyglądamy się temu, co po cichu Cię wyniszcza, i szukamy sensu, na którym można budować dłużej niż przez tydzień. Tempo i kierunek zależą od Ciebie.</p><h2 class="exm-akcent-zloty">Nie wracamy do tego, co było. Szukamy tego, co może być dalej.</h2>` }),
  b("wspolpraca", "tekst", { etykieta: "WSPÓŁPRACA · 05", tytul: "Jak wygląda współpraca",
    tresc: `<p class="exm-styl-lead">POWRÓT nie jest zbiorem niezależnych konsultacji. To uporządkowany proces indywidualnej pracy.</p><p>Przez kilka miesięcy spotykamy się regularnie, wracamy do ważnych decyzji i przyglądamy się temu, jak wprowadzasz zmianę w codziennym życiu. Między spotkaniami pracujesz z Dziennikiem powrotu, korzystasz z materiałów, które udostępniam Ci po sesjach, i masz ze mną kontakt w ustalonych granicach.</p><p>Nie podejmuję decyzji za Ciebie. Moją rolą jest pomagać Ci lepiej rozumieć własną sytuację, dostrzegać możliwości i brać odpowiedzialność za wybrane działania.</p>${META}` }, { tlo: G }),
  b("etapy", "karty", { etykieta: "DROGA · 06", tytul: "Cztery etapy\npowrotu", intro: "Każdy uczestnik przechodzi przez wszystkie cztery etapy. Tempo i akcenty dopasowujemy do Twojej sytuacji — to nie jest teoria, to droga, którą sam przeszedłem.", numerowane: true, kolumny: "2", karty: [
    { tytul: "I · Śmierć", opis: "Nazywamy, co w Tobie umarło. Bez dramatu i bez pocieszania. Prawda jest fundamentem powrotu." },
    { tytul: "II · Próg", opis: "Podejmujesz decyzję — nie deklarację, ale konkretny wybór, od którego zaczyna się dalsza praca." },
    { tytul: "III · Powrót", opis: "Odbudowujemy sens. Wnętrze. Codzienność. Tu dzieje się praca właściwa." },
    { tytul: "IV · Inny", opis: "Kim jesteś teraz. Jak dbać o to, co udało się odbudować, i jak iść dalej." },
  ] }),
  b("przebieg", "etapy", { etykieta: "PRZEBIEG", tytul: "Twoja droga\nw programie", uklad: "pionowy", elementy: [
    { tytul: "Początek", opis: "Pierwsza sesja: wspólnie tworzymy Mapę powrotu — Twój indywidualny plan pracy. Dostajesz dostęp do konta z Dziennikiem powrotu." },
    { tytul: "W trakcie", opis: `Sesje ${POWROT.cadence}. Po każdej udostępniam Ci w koncie materiały i zadania na kolejne dni. Między sesjami masz ze mną kontakt w ustalonych granicach.` },
    { tytul: "Domknięcie", opis: "Ostatnia sesja podsumowuje proces. Wychodzisz z osobistym planem dalszej drogi." },
    { tytul: "Po programie", opis: `Zamknięta ścieżka Listów powrotu dla absolwentów. Jeśli zechcesz wrócić po czasie, możesz umówić sesję kontrolną (${SESJA_KONTROLNA.minutes} minut, ${SESJA_KONTROLNA.priceText}).` },
  ] }, { tlo: G }),
  b("kto", "tekst_zdjecie", { etykieta: "KTO PROWADZI", tytul: "Każdą sesję prowadzę osobiście.", strona: "lewo", kolumny: "40-60", proporcja: "4:5", mobile: "gora",
    podpis: "DAWID · MENTOR EXMORTIS", zdjecie: { url: `${IMG}480c7c335_702144182_17895011880460401_728690723499574380_n.jpg`, alt: "Dawid — mentor programu POWRÓT" },
    tresc: `<p>Jestem Dawid. Kiedyś skończyło się życie, które znałem, i musiałem zbudować nowe od zera. Z tej drogi wyrósł POWRÓT — cztery etapy, przez które sam przeszedłem.</p><p>Pracuję jako mentor, nie terapeuta. Słucham, zadaję pytania i pomagam znaleźć następny krok. Decyzje podejmujesz Ty.</p><p>Prowadzę jednocześnie najwyżej ${POWROT.capacity} osoby, żeby każda miała moją pełną uwagę.</p>`,
    przyciski: [{ etykieta: "Poznaj moją historię", link: "/o-mnie?src=powrot", styl: "obrys", strzalka: true }] }),
  b("inwestycja", "tekst", { etykieta: "INWESTYCJA · 07", tytul: `${POWROT.priceText}\npełny program`,
    tresc: ul(POWROT_INCLUDES)
      + `<p><strong>${POWROT.priceText}</strong> to cena całkowita, bez dodatkowych opłat. ${POWROT.installments}</p>`
      + `<p>Prowadzę jednocześnie najwyżej ${POWROT.capacity} osoby. Start najbliższej edycji: ${POWROT.start}. Gdy miejsca są zajęte, zapisuję na listę oczekujących i podaję przewidywany termin.</p>`
      + `<h3>To nie jest kurs do odhaczenia.</h3><h3 class="exm-akcent-zloty">To praca nad własnym życiem.</h3>` }),
  b("srodek-przyciski", "przyciski", { przyciski: [ZGLOS, SPOTKANIE] }, { odstep: "maly" }),
  b("zasady", "tekst", { etykieta: "ZASADY · 08", tytul: "Zasady współpracy",
    tresc: ul([
      "<strong>Poufność.</strong> Sesje nie są nagrywane. Twoje odpowiedzi i moje notatki widzę tylko ja.",
      `<strong>Kontakt między sesjami.</strong> ${POWROT_CONTACT.lines.slice(0, 3).join(" ")}`,
      "<strong>Zmiana terminu.</strong> Sesję możesz bezpłatnie przełożyć najpóźniej 24 godziny przed jej rozpoczęciem.",
      `<strong>Przerwa.</strong> Jeśli z ważnej przyczyny potrzebujesz zatrzymać program, uzgadniamy przerwę, zwykle do ${POWROT.pauseWeeks} tygodni. Program wydłuża się o jej czas.`,
      "<strong>Materiały.</strong> Mapa i Dziennik powrotu oraz materiały z sesji są do Twojego osobistego użytku.",
      `<strong>Bezpieczeństwo.</strong> ${POWROT_CONTACT.lines[3]}`,
    ]) }, { tlo: G }),
  b("kwalifikacja", "etapy", { etykieta: "JAK DOŁĄCZYĆ · 09", tytul: "Pięć spokojnych\nkroków", uklad: "pionowy", elementy: [
    { tytul: "Zgłoszenie", opis: "Wypełniasz krótkie zgłoszenie. Zajmie około 2 minut." },
    { tytul: "Odpowiedź", opis: `Czytam każde zgłoszenie osobiście i odpowiadam w ciągu ${POWROT.responseHours} godzin. Jeśli widzę sens dalszej rozmowy, wysyłam Ci szczegółową ankietę.` },
    { tytul: "Ankieta", opis: "Kilka pytań, które porządkują Twoją sytuację i oczekiwania. Pytania o zdrowie są nieobowiązkowe i wymagają Twojej osobnej zgody." },
    { tytul: "Rozmowa wstępna", opis: `Jeśli dostaniesz zaproszenie, wybierasz termin w kalendarzu. ${ROZMOWA_WSTEPNA.minutes} minut online, bezpłatnie. Sprawdzamy wzajemne dopasowanie — to nie jest sesja ani terapia.` },
    { tytul: "Decyzja i start", opis: "Jeśli oboje zdecydujemy się na współpracę, dostajesz umowę, link do płatności i termin startu." },
  ] }),
  b("kwalifikacja-nota", "tekst", { tresc: "<p>Zgłoszenie jest bezpłatne, nie zobowiązuje do zakupu i nie oznacza automatycznego przyjęcia do programu.</p>" }, { szerokosc: "waska", odstep: "maly" }),
  b("faq", "faq", { etykieta: "PYTANIA · 10", tytul: "Pytania", pytania: [
    { pytanie: "Czym mentoring różni się od psychoterapii?", odpowiedz: "Mentoring exmortis koncentruje się na świadomej pracy nad decyzjami, kierunkiem życia i wprowadzaniem zmian. Nie jest diagnozą, psychoterapią ani leczeniem. Psychoterapia może pomagać także w obszarach rozwoju i trudności życiowych, dlatego te formy wsparcia nie zawsze się wykluczają. Jeśli potrzebujesz pomocy klinicznej, mentoring nie powinien jej zastępować." },
    { pytanie: "Ile kosztuje program i czy mogę płacić w ratach?", odpowiedz: POWROT_FAQ_PRICE },
    { pytanie: "Czy mogę kupić pojedynczą sesję zamiast całego programu?", odpowiedz: `Możesz umówić Rozmowę na progu: jedno spotkanie, ${ROZMOWA_NA_PROGU.length}, ${ROZMOWA_NA_PROGU.priceText}. To osobna usługa — nie jest sesją programu POWRÓT i nie zalicza się na jego poczet. Program to wielomiesięczny proces z Mapą i Dziennikiem powrotu, materiałami i pracą między spotkaniami.` },
    { pytanie: "Czy rozmowa wstępna jest płatna?", odpowiedz: `Nie. Trwa około ${ROZMOWA_WSTEPNA.minutes} minut i jest bezpłatna. Zaproszenie dostają osoby, których zgłoszenie i ankietę przeczytałem.` },
    { pytanie: "Czy zgłoszenie oznacza przyjęcie?", odpowiedz: "Nie. Decyzję podejmujemy wspólnie po ankiecie i rozmowie wstępnej. Zgłoszenie nie zobowiązuje Cię do zakupu." },
    { pytanie: "Jak wygląda kontakt między sesjami?", odpowiedz: POWROT_CONTACT.lines.join(" ") },
    { pytanie: "Co dostaję poza sesjami?", odpowiedz: "Mapę powrotu (indywidualny plan pracy), Dziennik powrotu w wersji cyfrowej, materiały i zadania udostępniane w Twoim koncie po kolejnych sesjach, sesję domykającą z planem dalszej drogi i dostęp do Listów powrotu dla absolwentów." },
    { pytanie: "Co, jeśli w trakcie programu potrzebuję przerwy?", odpowiedz: `Z ważnej przyczyny, na przykład zdrowotnej, uzgadniamy przerwę, zwykle do ${POWROT.pauseWeeks} tygodni. Program wydłuża się o jej czas.` },
    { pytanie: "Co, jeśli zrezygnuję?", odpowiedz: "Masz ustawowe 14 dni na odstąpienie od umowy. Zasady zakończenia udziału po tym terminie, w tym zwrot za sesje, które się nie odbyły, opisuje Umowa POWRÓT. Dostajesz ją do przeczytania przed płatnością." },
    { pytanie: "Czy otrzymam gwarancję zmiany?", odpowiedz: "Nie. Rezultaty zależą od wielu czynników, w tym od Twojej sytuacji i zaangażowania. Oferuję określoną strukturę i zakres pracy, a nie gwarancję konkretnego efektu." },
    { pytanie: "Czy program jest dla osoby w poważnym kryzysie psychicznym?", odpowiedz: "POWRÓT nie zastępuje pomocy psychologicznej, psychoterapeutycznej ani psychiatrycznej. Jeśli jej potrzebujesz, warto z niej skorzystać niezależnie od mentoringu. W nagłej sytuacji: 116 123, 800 70 2222, a w zagrożeniu życia 112." },
    { pytanie: "Czy muszę być osobą wierzącą?", odpowiedz: "Nie. Współpraca jest otwarta dla osób o różnych światopoglądach. Moja droga ma swoje źródło w wierze, ale nie jest warunkiem pracy ze mną — szanuję Twoje przekonania." },
    { pytanie: "Czy widujemy się na żywo?", odpowiedz: `Program prowadzę online, przez ${POWROT.form}, żeby był dostępny niezależnie od miasta. Uczestnicy POWRÓT-u mają pierwszeństwo w zapisach na doroczny retreat exmortis w Bieszczadach — szczegóły podam, gdy będą ustalone.` },
    { pytanie: "Ile osób prowadzisz jednocześnie?", odpowiedz: `Najwyżej ${POWROT.capacity}. Gdy miejsca są zajęte, zapisuję na listę oczekujących i podaję przewidywany termin startu.` },
    { pytanie: "Czy sesje są nagrywane i kto widzi moje odpowiedzi?", odpowiedz: "Sesje nie są nagrywane. Twoje zgłoszenie, ankietę i moje notatki z sesji widzę tylko ja. Notatki usuwam po 12 miesiącach od zakończenia współpracy." },
  ] }, { tlo: G }),
  b("podsumowanie", "modul", { modul: "powrot_podsumowanie" }),
  b("formularz", "modul", { modul: "powrot_formularz" }),
  b("ostatnie", "tekst", { etykieta: "OSTATNIE SŁOWO", tytul: "Nie musisz decydować się dziś.",
    tresc: `<p class="exm-styl-lead">Jeśli coś w Tobie mówi „to o mnie”, ale potrzebujesz więcej czasu, przyjdź najpierw na bezpłatne otwarte spotkanie i zobacz, jak pracuję. Tempo wybierasz Ty.</p>` }, { odstep: "maly" }),
  b("ostatnie-przyciski", "przyciski", { przyciski: [{ ...SPOTKANIE, etykieta: "Zobacz najbliższe otwarte spotkanie", styl: "zloty", strzalka: true, link: "/spotkania?src=powrot-koniec" }] }, { odstep: "maly" }),
  b("rozmowa-na-progu", "tekst", { etykieta: "OSOBNA USŁUGA", tytul: "Jedna rozmowa,\nbez programu",
    tresc: `<p>Jeśli nie masz jeszcze decyzji, a chcesz porozmawiać o swojej sytuacji już teraz, możesz umówić Rozmowę na progu: ${ROZMOWA_NA_PROGU.length} indywidualnie, online, ${ROZMOWA_NA_PROGU.priceText}.</p><p><strong>Rozmowa na progu nie ma związku z programem POWRÓT.</strong> Nie jest jego częścią ani pierwszą sesją, nie jest rozmową kwalifikacyjną i nie zalicza się na poczet ceny programu. To samodzielne, jednorazowe spotkanie.</p>`,
  }, { szerokosc: "waska", odstep: "maly", tlo: G }),
  b("rozmowa-na-progu-przycisk", "przyciski", { przyciski: [
    { etykieta: "Zobacz Rozmowę na progu", link: "/skarbiec/rozmowa-na-progu?src=powrot-koniec", styl: "obrys", strzalka: true },
  ] }, { odstep: "maly", tlo: G }),
  b("koniec", "cytat", { tekst: "„Wracam z siebie. Uczę wracać.”", podpis: "EXMORTIS — ZE ŚMIERCI" }, { wyrownanie: "srodek", szerokosc: "waska" }),
];

export const TEST_BLOCKS = [
  { id: "test-quiz", typ: "modul", widoczny: true, uklad: { ...L, numer: "brak" }, dane: { modul: "test",
    tytul: "Która śmierć jest Twoja?",
    tekst: "<p>Można funkcjonować i jednocześnie przestać żyć.</p><p>Dwa kroki: 15 stwierdzeń o ostatnich czterech tygodniach, potem wybór etapu drogi. Kilka minut. Odpowiadaj pierwszą myślą.</p>" } },
];
