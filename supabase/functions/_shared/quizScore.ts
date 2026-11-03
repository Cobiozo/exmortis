// Punktacja i teksty testu „Która śmierć jest Twoja?” (wersja 2) — jedno miejsce dla funkcji i testów.
// Reguły bez zmian względem wersji z 1.11.2026 (wydzielone z shopQuizSubmit 3.11.2026).
// ---------- wersja 2 ----------
// Kolejność stwierdzeń na stronie: M, D, Ż, M, D, Ż… — indeksy każdego obszaru w tablicy odpowiedzi.
export const V2 = { n: 15, max: 15, idx: { mentalna: [0, 3, 6, 9, 12], duchowa: [1, 4, 7, 10, 13], zyciowa: [2, 5, 8, 11, 14] } };
export const DIM_LABEL = { mentalna: "Mentalna", duchowa: "Duchowa", zyciowa: "Życiowa" };
export const LEVELS = [
  { key: "brak", label: "brak wyraźnych oznak", min: 0 },
  { key: "sygnaly", label: "pierwsze sygnały", min: 4 },
  { key: "wyraznie", label: "wyraźnie obecna", min: 8 },
  { key: "gleboko", label: "głęboko obecna", min: 12 },
];
export const levelOf = (score) => [...LEVELS].reverse().find((l) => score >= l.min);

export const DIM_TEXT = {
  mentalna: {
    brak: "W tym obszarze nie widać wyraźnych oznak. Masz dziś dostęp do energii i obecności — warto wiedzieć, co je podtrzymuje.",
    sygnaly: "Pojawiają się pierwsze sygnały: zmęczenie, które wraca, chwile działania na autopilocie. To jeszcze nie śmierć — to ostrzeżenie, które łatwo zagłuszyć kolejnym obowiązkiem.",
    wyraznie: "Zmęczenie i obojętność stały się tłem codzienności. Funkcjonujesz, ale coraz mniej w tym Ciebie. To miejsce, w którym najczęściej pada zdanie: „muszę się bardziej postarać”.",
    gleboko: "Odpowiedzi wskazują na głębokie wyczerpanie. Kiedy siły kończą się na tym poziomie, sama wola nie wystarczy — potrzebny jest odpoczynek, wsparcie bliskich i często rozmowa ze specjalistą.",
  },
  duchowa: {
    brak: "Sens i kierunek są dziś dla Ciebie dostępne. To zasób — warto go nazwać, zanim przyjdzie czas, w którym będzie potrzebny.",
    sygnaly: "Pojawiają się pytania o sens, które jeszcze nie bolą, ale nie dają spokoju. To często pierwszy znak, że dotychczasowe odpowiedzi robią się za ciasne.",
    wyraznie: "Sens, który dotąd niósł, przestał wystarczać. Masz to, co „powinno” dawać spełnienie — a w środku jest cisza. To nie niewdzięczność. To sygnał, że dawne odpowiedzi się wyczerpały.",
    gleboko: "Odpowiedzi wskazują na głęboką utratę sensu i kierunku. Pustka na tym poziomie bardzo obciąża — nie warto zostawać z nią w pojedynkę.",
  },
  zyciowa: {
    brak: "Nie widać śladów straty ani końca, który wciąż Cię zatrzymuje. Jeśli coś ważnego się skończyło, wygląda na to, że znalazło już swoje miejsce.",
    sygnaly: "Jest w Tobie coś, co się skończyło i wciąż daje o sobie znać. Wraca w pojedynczych chwilach, choć na co dzień sobie radzisz.",
    wyraznie: "Jedno wydarzenie podzieliło życie na „przed” i „po”. Otoczenie oczekuje, że to już za Tobą, a Ty wciąż jesteś w środku. To nie opóźnienie — żałoba ma własny czas.",
    gleboko: "Odpowiedzi wskazują, że strata wciąż zajmuje bardzo dużo miejsca i odbiera siły na codzienność. Przez to nie trzeba przechodzić w pojedynkę.",
  },
};

// Nagłówek z imieniem (wersja z e-mailem sprzed 3.11) albo bez — wtedy od wielkiej litery.
const withName = (n, rest) => (n ? `${n}, ${rest}` : rest.charAt(0).toUpperCase() + rest.slice(1));

export const DOMINANT = {
  Mentalna: {
    head: (n) => withName(n, "w Twoich odpowiedziach najwyraźniej widać śmierć mentalną."),
    body: "Śmierć mentalna nie wygląda jak upadek. Wygląda jak sprawne działanie: obowiązki zrobione, terminy dotrzymane, a w środku coraz mniej obecności. Największa pułapka tego miejsca brzmi: „muszę się bardziej postarać”. Nie musisz bardziej. Najpierw trzeba się zatrzymać i zobaczyć, co naprawdę zabiera Ci siły — i po co to wszystko robisz.",
    questions: ["Co robisz dziś tylko dlatego, że „tak trzeba”?", "Kiedy ostatnio coś naprawdę Cię ożywiło — i co wtedy było inne?", "Co by się stało, gdyby przez tydzień nikt nie widział Twojego wysiłku?"],
  },
  Duchowa: {
    head: (n) => withName(n, "w Twoich odpowiedziach najwyraźniej widać śmierć duchową."),
    body: "Śmierć duchowa przychodzi cicho. Z zewnątrz wszystko jest na miejscu, a w środku gaśnie światło, które dawało kierunek. Pustka nie jest niewdzięcznością ani słabością. Jest znakiem, że dawne odpowiedzi stały się za ciasne. Sensu nie znajduje się gotowego. Sens się buduje — od pytań, których dotąd nie było wolno zadać.",
    questions: ["Co straciło dla Ciebie znaczenie w ostatnich latach?", "Za czym tęsknisz, kiedy wokół robi się cicho?", "Gdyby nikt nie oceniał Twojego wyboru — jaki byłby następny krok?"],
  },
  Życiowa: {
    head: (n) => withName(n, "w Twoich odpowiedziach najwyraźniej widać śmierć życiową."),
    body: "Śmierć życiowa ma datę. Strata, rozstanie, koniec pracy, zdrowia albo roli, która była całym życiem. Świat ma krótką pamięć i szybko oczekuje powrotu do formy. Nie chodzi jednak o powrót do siebie sprzed. Chodzi o zbudowanie nowego domu w miejscu, w którym ten pierwszy się spalił.",
    questions: ["Co skończyło się razem z tym wydarzeniem — poza tym, co widać?", "Czego nie pozwalasz sobie jeszcze opłakać?", "Co z tamtego życia chcesz zabrać dalej, a co zostawić?"],
  },
  Mieszana: {
    head: (n) => withName(n, "niesiesz więcej niż jedną śmierć."),
    body: "Tak jest u większości ludzi, którzy do mnie przychodzą. Jedna śmierć uruchamia drugą, druga maskuje trzecią: strata odbiera sens, brak sensu wyczerpuje, a wyczerpanie nie pozwala przeżyć straty. Dlatego warto zacząć nie od jednego fragmentu, ale od mapy całej drogi — i od pytania, która śmierć była pierwsza.",
    questions: ["Która z tych śmierci była pierwsza?", "Która z nich zabiera Ci dziś najwięcej sił?", "Gdyby można było zająć się dziś tylko jedną — która by to była?"],
  },
  Żadna: {
    head: (n) => withName(n, "żadna z trzech śmierci nie dominuje."),
    body: "Twoje odpowiedzi są niskie we wszystkich trzech obszarach. To może znaczyć, że jesteś dziś w dobrym miejscu — i warto wiedzieć, co Cię w nim trzyma. Może też znaczyć, że trudne rzeczy są dobrze schowane. Odpowiedz sobie uczciwie, co jest bliższe prawdy, i wróć do testu za kilka tygodni.",
    questions: ["Co dziś daje Ci siłę, sens i oparcie?", "O co dbasz, żeby tak zostało?", "Czy ktoś w Twoim otoczeniu przechodzi teraz swoją śmierć?"],
  },
};

export function scoreV2(answers) {
  const sum = (idx) => idx.reduce((acc, i) => acc + Number(answers[i]), 0);
  const scores = { mentalna: sum(V2.idx.mentalna), duchowa: sum(V2.idx.duchowa), zyciowa: sum(V2.idx.zyciowa) };
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  let dominant = DIM_LABEL[ranked[0][0]];
  if (ranked[0][1] < LEVELS[1].min) dominant = "Żadna";
  else if (ranked[1][1] >= LEVELS[1].min && ranked[0][1] - ranked[1][1] <= 2) dominant = "Mieszana";
  const dims = Object.keys(scores).map((k) => {
    const l = levelOf(scores[k]);
    return { key: k, label: DIM_LABEL[k], score: scores[k], max: V2.max, level: l.key, level_label: l.label, text: DIM_TEXT[k][l.key] };
  });
  return { scores, dominant, dims, deep: dims.some((d) => d.level === "gleboko") };
}

export const STAGE_TEXT = {
  "Śmierć": "Jesteś na początku drogi. Tu nie trzeba jeszcze niczego zmieniać — trzeba zobaczyć i nazwać, co się skończyło.",
  "Próg": "Wiesz już, co umarło. Teraz liczy się jedna rzecz: decyzja, nie deklaracja.",
  "Powrót": "Budujesz coś nowego. To najdłuższy etap — i ten, w którym najłatwiej wrócić do starego.",
  "Inny": "Najtrudniejsze masz za sobą. Teraz zadanie na długo: nie wrócić do tego, co Cię zabijało.",
};

