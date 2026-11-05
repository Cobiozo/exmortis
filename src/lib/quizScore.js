// Test „Która śmierć jest Twoja?” — wersja redakcyjna 3.1 (5.11.2026).
// Liczone WYŁĄCZNIE w przeglądarce. Trzy śmierci to autorskie metafory EXMORTIS, nie kategorie medyczne.
// Sumy 0–15 na obszar służą tylko uporządkowaniu, z którą historią ktoś najbardziej się utożsamia —
// to umowne progi redakcyjne, nie granice psychologiczne ani skala nasilenia. Na ekranie nie ma punktów.

export const DIMS = ["mentalna", "duchowa", "zyciowa"];
export const DIM_LABEL = { mentalna: "Śmierć mentalna", duchowa: "Śmierć duchowa", zyciowa: "Śmierć życiowa" };

// Kolejność na ekranie: M1, D1, Ż1, M2, D2, Ż2… — bez nazw kategorii podczas odpowiadania.
export const QUESTIONS = [
  { dim: "mentalna", text: "Mój dzień jest wypełniony od rana do wieczora. Potrafię powiedzieć, co udało mi się zrobić. Trudniej powiedzieć, co z tego było naprawdę dla mnie." },
  { dim: "duchowa", text: "Przez lata było dla mnie jasne, w co wierzę i na czym opieram życie. Dziś niektórych z tych przekonań nie potrafię już wypowiedzieć z dawną pewnością." },
  { dim: "zyciowa", text: "W mojej historii jest wydarzenie, po którym nawet zwyczajne sprawy zaczęły wyglądać inaczej. Pamiętam, jaki świat był przed nim." },
  { dim: "mentalna", text: "Znam swoje obowiązki tak dobrze, że wykonuję je niemal bez zastanowienia. Własne potrzeby odkładam, jakby zawsze mogły poczekać." },
  { dim: "duchowa", text: "Mam dziś wiele z tego, do czego kiedyś zmierzało moje życie. Samo dotarcie nie daje mi jednak tego, czego tam szukam." },
  { dim: "zyciowa", text: "Moje życie zmieniło się na tyle, że czasami przyłapuję się na myśleniu o przyszłości, która miała się wydarzyć, ale już się nie wydarzy." },
  { dim: "mentalna", text: "Są rzeczy, na które od dawna nie mam ochoty, ale robię je nadal. Nie dlatego, że je wybieram. Dlatego, że inni przywykli, że właśnie ja się nimi zajmuję." },
  { dim: "duchowa", text: "Potrafię uzasadnić wiele swoich decyzji. Najtrudniej przychodzi mi odpowiedzieć, dlaczego właśnie takie życie miałoby mieć dla mnie znaczenie." },
  { dim: "zyciowa", text: "Ludzie widzą, że moje życie toczy się dalej. Nie widzą, jak wiele rzeczy nadal odnoszę do tego, co się skończyło." },
  { dim: "mentalna", text: "Ludzie wiedzą, kim jestem dla nich. Gdyby odebrać mi wszystkie role i obowiązki, nie wiem, co jeszcze umiem powiedzieć o sobie." },
  { dim: "duchowa", text: "Są prawdy, których bronię od lat. Dziś nie wiem, czy nadal w nie wierzę, czy boję się zobaczyć swoje życie bez nich." },
  { dim: "zyciowa", text: "Coś, co było częścią mnie, odeszło. Brakuje mi nie tylko tego, czego już nie ma, ale też tej części mnie, która wtedy istniała." },
  { dim: "mentalna", text: "Zdarza mi się patrzeć na swoje życie jak na dom, w którym wszystko utrzymuję w porządku, ale w którym coraz rzadziej czuję się u siebie." },
  { dim: "duchowa", text: "Nie tęsknię za dawnym życiem tak bardzo, jak za poczuciem, że wiem, po co robię to, co robię." },
  { dim: "zyciowa", text: "Są miejsca, słowa albo zwyczajne momenty, które przypominają mi o życiu, którego już nie prowadzę." },
];

export const SCALE = [
  { value: 0, label: "Zupełnie mnie to nie dotyczy" },
  { value: 1, label: "Trochę mnie to dotyczy" },
  { value: 2, label: "W dużej mierze mnie to dotyczy" },
  { value: 3, label: "Bardzo mocno się w tym odnajduję" },
];

export const STAGES = [
  { key: "Śmierć", text: "Wiem, że coś się skończyło. Nie umiem jeszcze opowiedzieć, co to zmieniło we mnie.",
    result: "Rozpoznajesz koniec lub zmianę czegoś ważnego. Nie musisz jeszcze nadawać temu ostatecznego znaczenia." },
  { key: "Próg", text: "Coraz trudniej mi udawać przed sobą, że chcę dalej żyć dokładnie tak samo. Widzę możliwość zmiany, ale wciąż stoję przed nią.",
    result: "Widzisz możliwość innego życia, choć nie wszystkie decyzje zapadły. Samo dostrzeżenie tej różnicy jest ważnym krokiem." },
  { key: "Powrót", text: "Nie mam gotowego nowego życia. Ale są już w nim wybory, które dawniej nie przyszłyby mi do głowy.",
    result: "Coś nowego zaczyna zajmować miejsce w Twojej codzienności. Nie wszystko musi być od razu uporządkowane." },
  { key: "Inny", text: "Nie jestem już tą samą osobą co przed tamtą historią. Nie wszystko udało się odzyskać. Nie wszystko chcę odzyskiwać. Uczę się żyć tym, kim jestem dzisiaj.",
    result: "Widzisz w sobie zmianę. Twoja historia pozostaje częścią Ciebie, ale nie musi określać całej przyszłości." },
];

// Wyniki A–E. Układ: nagłówek, opis (akapity), „Jak to może wyglądać”, „Co może być teraz ważne”, pytanie.
export const RESULTS = {
  mentalna: {
    kicker: "ŚMIERĆ MENTALNA",
    head: "Wszystko działa. Tylko coraz mniej w tym Ciebie.",
    body: [
      "Nie każda utrata siebie wygląda jak kryzys. Czasem wygląda jak dobrze zorganizowane życie: wypełnione zadania, dotrzymane obietnice, ludzie, którzy wiedzą, że mogą na Tobie polegać.",
      "W Twoich odpowiedziach najmocniej wybrzmiewa historia kogoś, kto nauczył się być potrzebny — tak dobrze, że własne potrzeby trafiły na koniec listy. To nie jest słabość. To często skutek lat odpowiedzialności, lojalności i troski o innych.",
    ],
    looks: "Dzień przelatuje między obowiązkami, a pytanie „czego ja chcę?” brzmi obco albo egoistycznie. Odpoczynek trzeba sobie najpierw „zarobić”. Łatwiej powiedzieć, kim jesteś dla innych, niż kim jesteś po prostu.",
    now: "Zauważyć jedną rzecz w tygodniu, którą robisz wyłącznie z przyzwyczajenia — i zapytać siebie, czy nadal chcesz ją nieść. Odzyskać choć jedną małą przestrzeń, która nie służy nikomu poza Tobą. Nie musisz od razu niczego zmieniać. Wystarczy przestać udawać przed sobą, że wszystko jest na swoim miejscu.",
    question: "Czy ja jeszcze wybieram to życie, czy już tylko je obsługuję?",
  },
  duchowa: {
    kicker: "ŚMIERĆ DUCHOWA",
    head: "Nie wszystko, w co wierzysz od lat, potrafi Cię jeszcze prowadzić.",
    body: [
      "Najtrudniej rozstać się czasem nie z człowiekiem ani miejscem, ale z własną pewnością. Z odpowiedziami, które porządkowały świat. Z celami, dla których warto było wiele poświęcić. Z przekonaniami, których broniło się przez lata.",
      "W Twoich odpowiedziach najmocniej wybrzmiewa moment, w którym dawne odpowiedzi przestają wystarczać, a nowe jeszcze się nie pojawiły. Nie musi to mieć nic wspólnego z religią. Chodzi o pytanie, po co idziesz dalej.",
    ],
    looks: "Osiągnięte cele cieszą krócej, niż się spodziewasz. Zdania, które kiedyś wypowiadało się z przekonaniem, dziś brzmią jak cudze. W ciszy pojawia się pytanie, którego nie da się zbyć szybką odpowiedzią.",
    now: "Nie uciekać od pytań tylko dlatego, że nie mają jeszcze odpowiedzi. Oddzielić to, w co naprawdę wierzysz, od tego, czego się po Tobie spodziewano. Pozwolić sobie na okres „pomiędzy” — bez pośpiechu, by natychmiast zastąpić dawną pewność nową.",
    question: "W co nadal wierzę naprawdę — nawet gdy nikt nie oczekuje ode mnie, że będę tego bronić?",
  },
  zyciowa: {
    kicker: "ŚMIERĆ ŻYCIOWA",
    head: "Świat poszedł dalej. Twoja historia nie mieści się w tym tempie.",
    body: [
      "Niektóre wydarzenia zmieniają więcej niż plany. Zmieniają miejsce, jakie zajmujemy w świecie. Znika relacja, rola, poczucie przynależności albo przyszłość, która wydawała się oczywista. Potem zaczyna się nowe życie — nie zawsze dlatego, że jesteśmy gotowi. Czasem po prostu dlatego, że dni następują po sobie.",
      "W Twoich odpowiedziach wyraźnie widać historię, która ma swoje „przed” i „po”. Otoczenie może już widzieć kolejny rozdział, a Ty wciąż odnosisz wiele rzeczy do tego, co się skończyło. To nie jest opóźnienie. Każda strata ma swój czas.",
    ],
    looks: "Zwyczajne miejsca, słowa albo pory roku przypominają o życiu, którego już nie prowadzisz. Myśli wracają do przyszłości, która miała się wydarzyć. Trudno opowiedzieć innym, co właściwie się zmieniło, bo zmieniło się więcej niż to, co widać.",
    now: "Nazwać, co dokładnie się skończyło — także to, czego nie widać z zewnątrz. Zachować to, co z dawnej historii nadal jest Twoje. Nie zamykać rozdziału na życzenie otoczenia. Nie każda strata daje się zamknąć i nie każda musi przestać być ważna.",
    question: "Za czym naprawdę tęsknię: za tym, co odeszło, czy także za częścią mnie, która wtedy żyła?",
  },
  wiele: {
    kicker: "WIĘCEJ NIŻ JEDNA ŚMIERĆ",
    head: "Niektóre historie pękają w kilku miejscach naraz.",
    body: [
      "W Twoich odpowiedziach kilka historii jest równie wyraźnych. Tak bywa najczęściej. Strata może podważyć przekonania. Lata życia dla innych mogą oddalić od własnych wyborów. Utrata kierunku może zmienić to, jak patrzysz na swoje miejsce w świecie.",
    ],
    looks: "Trudno wskazać jedno wydarzenie, od którego wszystko się zaczęło. Kiedy próbujesz uporządkować jedną sprawę, odzywają się dwie kolejne. Zmęczenie jednym obszarem sprawia, że brakuje sił na zrozumienie pozostałych.",
    now: "Nie rozwiązywać wszystkiego naraz. Zobaczyć, która z tych historii była pierwsza, a która najbardziej odbiera Ci dziś przestrzeń. Zacząć od jednej nici — reszta często zaczyna się rozplątywać razem z nią.",
    question: "Co w moim życiu zmieniło się pierwsze — i jak ta zmiana dotknęła pozostałych obszarów?",
  },
  zadna: {
    kicker: "ŻADNA NIE DOMINUJE",
    head: "Nie musisz szukać w sobie śmierci, żeby docenić życie.",
    body: [
      "Twoje odpowiedzi nie wskazują na szczególną bliskość żadnej z trzech historii. Być może jesteś dziś w miejscu, w którym czujesz spójność z własnymi wyborami. A być może Twoje doświadczenie po prostu nie mieści się w tych piętnastu zdaniach. Obie odpowiedzi mają swoje miejsce.",
      "Ten test nie ma nikogo przekonywać, że coś w jego życiu jest nie tak.",
    ],
    looks: null,
    now: "Nazwać, co dziś daje Ci oparcie — i świadomie o to dbać. Zauważyć, czy ktoś bliski nie przechodzi właśnie przez swoją historię. Wrócić do tych zdań za jakiś czas — życie się zmienia, a z nim odpowiedzi.",
    question: "Co w moim życiu jest dziś tak prawdziwe, że nie chcę tego stracić?",
  },
};

// Reguły (kolejność ma znaczenie):
// 1) wszystkie obszary ≤ 3 → „zadna”; 2) dwa najwyższe ≥ 5 i różnica ≤ 2 → „wiele”;
// 3) remis najwyższych → „wiele”; 4) inaczej najwyższy obszar.
export function scoreTest(answers) {
  const scores = Object.fromEntries(DIMS.map((d) => [d, 0]));
  QUESTIONS.forEach((q, i) => { scores[q.dim] += Number(answers[i]) || 0; });
  const ranked = DIMS.slice().sort((a, b) => scores[b] - scores[a]);
  const [a, b] = ranked;
  let key;
  if (DIMS.every((d) => scores[d] <= 3)) key = "zadna";
  else if (scores[a] >= 5 && scores[b] >= 5 && scores[a] - scores[b] <= 2) key = "wiele";
  else if (scores[a] === scores[b]) key = "wiele";
  else key = a;
  return { key, ranked, scores };
}
