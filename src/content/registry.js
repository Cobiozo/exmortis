// Rejestr edytowalnych treści stron — używa go panel „Treści stron" w zapleczu.
// Strony czytają nadpisania przez useSiteContent(); bez nadpisania obowiązują wartości z kodu.

import { SYSTEM_BLOCKS } from "./systemTexts";
import { LOGIN_BLOCKS } from "./loginTexts";

export const CONTENT_PAGES = [
  { key: "system", label: "Teksty systemowe", blocks: SYSTEM_BLOCKS },
  { key: "login", label: "Logowanie", blocks: LOGIN_BLOCKS },
  {
    key: "home",
    label: "Strona główna",
    blocks: [
      {
        key: "heroSubtitle",
        label: "Hero — podpis pod logo",
        type: "richtext",
        default: "Wracam z siebie. Uczę wracać.<br />Droga powrotu ze śmierci mentalną, duchową i życiową.",
      },
      {
        key: "manifest",
        label: "Manifest — kolejne linie",
        type: "list",
        default: [
          "Są dni, kiedy człowiek żyje, ale w środku już umarł.",
          "Chodzi, pracuje, uśmiecha się — a nie czuje nic.",
          "To nie słabość. To śmierć mentalna. Duchowa. Życiowa.",
          "I nikt o niej głośno nie mówi.",
          "Ja tam byłem. I wróciłem. Inny.",
          "exmortis to nie motywacja. To droga powrotu.",
          "Nie musisz być gotowy. Musisz zrobić pierwszy ruch.",
          "Reszty nauczę Cię po drodze.",
        ],
      },
      {
        key: "deaths",
        label: "Trzy śmierci — karty",
        type: "cards",
        fields: ["title", "desc"],
        default: [
          {
            title: "Śmierć mentalna",
            desc: "Żyjesz na autopilocie i nic nie czujesz. Dni się powtarzają, a w środku jest cisza, której nie umiesz nazwać.",
          },
          {
            title: "Śmierć duchowa",
            desc: "Tracisz sens i nie wiesz, po co to wszystko. Wszystko działa, ale nic nie rezonuje.",
          },
          {
            title: "Śmierć życiowa",
            desc: "Rozstanie, żałoba, bankructwo albo choroba zabrały Ci grunt pod nogami.",
          },
        ],
      },
      {
        key: "truths",
        label: "Trzy zdania — kolejne linie",
        type: "list",
        default: [
          "Nie musisz być silny, żeby wrócić. Musisz zrobić pierwszy ruch.",
          "Śmierć mentalna, duchowa i życiowa nie są końcem — są progiem.",
          "Wracasz nie do tego, kim byłeś. Wracasz jako ktoś nowy.",
        ],
      },
      {
        key: "forWhomPoints",
        label: "Dla kogo — lista punktów",
        type: "list",
        default: [
          "Wracasz z wypalenia zawodowego",
          "Wracasz z kryzysu w relacji",
          "Wracasz z fasady, którą budowałeś latami",
          "Wracasz do siebie, którego kiedyś zostawiłeś",
          "Wracasz z ciszy po stracie",
          "Wracasz z pozycji lidera, który się w tej pozycji zgubił",
          "Wracasz z etapu, który dał Ci wszystko oprócz Ciebie",
        ],
      },
      {
        key: "forWhomSlogan",
        label: "Dla kogo — złote zdanie",
        type: "richtext",
        default: "Wracam inny.<br />Uczę wracać.",
      },
      {
        key: "forWhomClose",
        label: "Dla kogo — zdanie zamykające",
        type: "richtext",
        default:
          "Jeśli którykolwiek punkt zabrzmiał jak Twoje życie — jesteś we właściwym miejscu. Pierwszy ruch zrobisz dziś.",
      },
      {
        key: "powrotTeaserQuote",
        label: "Zajawka POWRÓT — cytat",
        type: "richtext",
        default:
          "„Nowa wersja Ciebie nie powstaje z tej samej gliny, co poprzednia.<br />Trzeba ją wypalić.”",
      },
      {
        key: "powrotTeaserDesc",
        label: "Zajawka POWRÓT — opis programu",
        type: "richtext",
        default:
          "Autorski program mentorski exmortis — dla tych, którzy wychodzą ze śmierci mentalnej, duchowej albo życiowej. Sześć miesięcy, cztery etapy, osiem sesji jeden na jeden. Prowadzę maksymalnie cztery osoby jednocześnie.",
      },
      {
        key: "testimonialsTitle",
        label: "Świadectwa — nagłówek",
        type: "richtext",
        default: 'Oni też<br /><span class="gold-text">wracali</span>',
      },
      {
        key: "testimonialsIntro",
        label: "Świadectwa — wprowadzenie",
        type: "richtext",
        default: "Nie planuj powrotu na podstawie obietnic. Słuchaj tych, którzy już przeszli.",
      },
      {
        key: "testimonials",
        label: "Świadectwa — opinie",
        type: "cards",
        fields: ["text", "name", "source"],
        default: [
          {
            text: "Myślałem, że wrócić znaczy wrócić do dawnego siebie. Dopiero na warsztacie zrozumiałem, że wracam jako ktoś inny — i że to jest lepsze.",
            name: "Marek",
            source: "Mini-Warsztat: Rytuał Pierwszego Ruchu",
          },
          {
            text: "To nie jest kolejna książka o motywacji. To konkret. Pierwszy ruch zrobiłem tego samego dnia, skończyłem czytać i po prostu poszedłem.",
            name: "Anna",
            source: "Ebook „Wracam Inny”",
          },
          {
            text: "Poszedłem na mentoring, bo nic już nie czułem. Po dwóch sesjach po raz pierwszy od roku coś mnie poruszyło. Nie jestem gotowy — ale ruszyłem.",
            name: "Tomek",
            source: "Mentoring 1:1 POWRÓT",
          },
        ],
      },
      {
        key: "ctaTitle",
        label: "Sekcja końcowa — nagłówek",
        type: "richtext",
        default: 'Zrób<br /><span class="gold-text">jeden ruch</span>',
      },
      {
        key: "ctaText",
        label: "Sekcja końcowa — tekst",
        type: "richtext",
        default:
          "Powrót nie zaczyna się od siły. Zaczyna się od jednego ruchu — małego, wykonalnego dziś.",
      },
    ],
  },
  {
    key: "about",
    label: "O mnie",
    blocks: [
      {
        key: "heroTitle",
        label: "Nagłówek główny",
        type: "richtext",
        default: 'Byłem tam.<br /><span class="gold-text">I wróciłem.</span><br />Inny.',
      },
      {
        key: "heroIntro",
        label: "Wprowadzenie obok nagłówka",
        type: "richtext",
        default:
          "exmortis to nie «mentor dla liderów». To głos powrotu. Moja przewaga nie leży w tym, że uczę sprzedaży — to potrafi wielu. Moja przewaga to droga tam i z powrotem.",
      },
      {
        key: "manifesto",
        label: "Manifest osobisty — akapity",
        type: "richtext",
        default:
          "<p>Są dni, kiedy człowiek żyje, ale w środku już umarł. Chodzi, pracuje, uśmiecha się — a nie czuje nic.</p><p>Ja tam byłem. W miejscu, z którego wydawało się, że nie ma powrotu. Wróciłem. Nie do tego, kim byłem — jako ktoś nowy.</p><p class=\"gold-text\">To sprzedaje się dziś najmocniej, bo jest nie do podrobienia. Droga tam i z powrotem.</p>",
      },
      {
        key: "timeline",
        label: "Droga — etapy",
        type: "cards",
        fields: ["phase", "text"],
        default: [
          {
            phase: "Śmierć",
            text: "Chodziłem, pracowałem, uśmiechałem się — a w środku była cisza, której nie umiałem nazwać. Żyłem na autopilocie.",
          },
          {
            phase: "Próg",
            text: "Moment, w którym zrozumiałem: to, co uważałem za koniec, jest progiem. Trzeba było przez niego przejść.",
          },
          {
            phase: "Powrót",
            text: "Powrót nie zaczyna się od siły. Zaczyna się od jednego ruchu. Małego. Wykonalnego. Powtórzonego jutro.",
          },
          {
            phase: "Inny",
            text: "Wracam nie do tego, kim byłem. Wracam jako ktoś nowy. I uczę wracać innych.",
          },
        ],
      },
      {
        key: "principles",
        label: "Postawa — zasady",
        type: "cards",
        fields: ["title", "text"],
        default: [
          {
            title: "Przewodnik, nie terapeuta",
            text: "Prowadzę przez powrót, nie leczę zaburzeń. Przy objawach klinicznych kieruję do specjalisty. To buduje zaufanie.",
          },
          {
            title: "Pytania zamiast rad",
            text: "Nie mówię «zrób tak», tylko pytam: co się w Tobie dzieje, kiedy to mówisz? Więcej słucham niż mówię.",
          },
          {
            title: "Jeden ruch na sesję",
            text: "Każde spotkanie kończy się jednym konkretnym ruchem do wykonania. Bo powrót to ruchy, nie plany na rok.",
          },
        ],
      },
      {
        key: "ctaTitle",
        label: "Sekcja końcowa — nagłówek",
        type: "richtext",
        default: 'Jeśli coś w Tobie<br /><span class="gold-text">już wie</span>',
      },
      {
        key: "ctaText",
        label: "Sekcja końcowa — tekst",
        type: "richtext",
        default:
          "Że chodzisz i pracujesz, a w środku jest cisza — to znaczy, że już wracasz. Zrób pierwszy ruch.",
      },
    ],
  },
  {
    key: "glos",
    label: "Głos",
    blocks: [
      {
        key: "heroIntro",
        label: "Hero — wprowadzenie",
        type: "richtext",
        default: "Muzyka powrotu i podcasty o drodze tam i z powrotem. Słuchaj tam, gdzie jesteś.",
      },
    ],
  },
  {
    key: "contact",
    label: "Kontakt",
    blocks: [
      {
        key: "heading",
        label: "Nagłówek sekcji",
        type: "richtext",
        default: 'Napisz.<br /><span class="gold-text">Odpowiadam sam.</span>',
      },
      {
        key: "intro",
        label: "Wprowadzenie",
        type: "richtext",
        default:
          "Nie ma botów i asystentów. Jeśli jesteś na progu — napisz pierwszy ruch, choćby jednym zdaniem.",
      },
    ],
  },
  {
    key: "footer",
    label: "Stopka",
    blocks: [
      {
        key: "newsletterTitle",
        label: "Newsletter — nagłówek",
        type: "richtext",
        default: 'Zapisz się.<br /><span class="blood-text">Wracaj</span> co tydzień.',
      },
      {
        key: "newsletterDesc",
        label: "Newsletter — opis",
        type: "richtext",
        default:
          "Jeden list tygodniowo. Jeden temat powrotu. Jedno narzędzie. Prosto na Twój mail — z prezentem powitalnym: mini-PDF „3 pierwsze ruchy powrotu”.",
      },
      {
        key: "about",
        label: "Opis marki",
        type: "richtext",
        default:
          "Wracam z siebie. Uczę wracać. Głos powrotu ze śmierci mentalnej, duchowej i życiowej. Siła nie jest warunkiem powrotu. Wystarczy pierwszy ruch.",
      },
    ],
  },
];