import { POWROT, POWROT_CONTACT, ROZMOWA_WSTEPNA } from "@/lib/powrotOffer";

// Szablony wiadomości POWRÓT (master prompt v2, 18.11.2026). Panel pokazuje podgląd do edycji,
// a wiadomość wychodzi dopiero po kliknięciu „Wyślij”. Ton: osobisty, spokojny, bez presji sprzedażowej.
// Akapity rozdziela pusta linia. Status po wysłaniu ustala serwer (adminPowrot → TEMPLATE_STATUS).
const first = (a) => String(a?.full_name || "").trim().split(/\s+/)[0] || "";
const PODPIS = "Dawid\nEXMORTIS";
const POMOC = "Jeśli jest Ci teraz bardzo ciężko, nie czekaj: 116 123 lub 800 70 2222 (całą dobę, bezpłatnie), w zagrożeniu życia 112.";

export const STATUS_LABEL = {
  nowe: "Nowe zgłoszenie",
  ankieta_wyslana: "Ankieta wysłana",
  ankieta_wypelniona: "Ankieta wypełniona",
  zaproszony: "Zaproszony do rozmowy",
  rozmowa_zaplanowana: "Rozmowa zaplanowana",
  rozmowa_odbyta: "Rozmowa odbyta",
  oferta: "Oferta wysłana",
  w_programie: "W programie",
  wstrzymany: "Wstrzymany",
  zakonczony: "Zakończony · absolwent",
  lista_oczekujacych: "Lista oczekujących",
  odroczone: "Odroczone",
  inna_forma: "Inna forma wsparcia",
  zamkniete: "Zamknięte",
};

export const TABS = [
  { key: "decyzja", label: "Do decyzji", statuses: ["nowe", "ankieta_wypelniona", "rozmowa_odbyta"] },
  { key: "toku", label: "W toku", statuses: ["ankieta_wyslana", "zaproszony", "rozmowa_zaplanowana", "oferta", "lista_oczekujacych"] },
  { key: "program", label: "W programie", statuses: ["w_programie", "wstrzymany"] },
  { key: "archiwum", label: "Archiwum", statuses: ["zakonczony", "odroczone", "inna_forma", "zamkniete"] },
  { key: "wszystkie", label: "Wszystkie", statuses: null },
];

export const TEMPLATES = [
  {
    key: "info", label: "Poproś o dodatkową informację",
    make: (a) => ({
      subject: "Twoje zgłoszenie do programu POWRÓT — jedno pytanie",
      body: `${first(a)}, dziękuję za zgłoszenie.\n\nZanim zdecyduję o dalszym kroku, chcę zapytać: [wpisz pytanie].\n\nWystarczy odpowiedzieć na tę wiadomość.\n\n${PODPIS}`,
    }),
  },
  {
    key: "lista", label: "Lista oczekujących",
    make: (a) => ({
      subject: "Twoje zgłoszenie do programu POWRÓT",
      body: `${first(a)}, dziękuję za zgłoszenie i odpowiedzi.\n\nProwadzę jednocześnie najwyżej ${POWROT.capacity} osoby, żeby każda miała moją pełną uwagę. W tej chwili wszystkie miejsca są zajęte.\n\nZapisuję Cię na listę oczekujących. Przewidywany termin, w którym mogę zaproponować start: [wpisz miesiąc]. Odezwę się wtedy sam — nie musisz pilnować terminu.\n\nNie zapisuję Cię na żaden newsletter. Jeśli w międzyczasie zdecydujesz się na inną drogę, po prostu daj znać.\n\n${PODPIS}`,
    }),
  },
  {
    key: "odroczenie", label: "Odroczenie",
    make: (a) => ({
      subject: "Twoje zgłoszenie do programu POWRÓT",
      body: `${first(a)}, dziękuję za zaufanie i przesłanie zgłoszenia.\n\nPo zapoznaniu się z Twoimi odpowiedziami nie proponuję teraz rozpoczęcia programu POWRÓT.\n\nNie jest to ocena Ciebie ani znaczenia spraw, z którymi przychodzisz. Chodzi o dopasowanie tej konkretnej formy współpracy do Twoich obecnych możliwości i potrzeb.\n\nJeśli Twoja sytuacja albo oczekiwania się zmienią, możesz zgłosić się ponownie. Do tego czasu możesz korzystać z bezpłatnych materiałów exmortis: exmortis.pl/zacznij.\n\n${PODPIS}`,
    }),
  },
  {
    key: "inna_forma", label: "Inna forma wsparcia",
    make: (a) => ({
      subject: "Twoje zgłoszenie do programu POWRÓT",
      body: `${first(a)}, dziękuję, że napisałeś do mnie o tym, co przeżywasz.\n\nPo przeczytaniu Twojego zgłoszenia uważam, że mentoring nie jest teraz najlepszą formą wsparcia dla Ciebie. To, o czym piszesz, zasługuje na pomoc specjalisty — psychologa, psychoterapeuty albo lekarza — i warto z niej skorzystać w pierwszej kolejności.\n\nJeśli nie wiesz, od czego zacząć, możesz zadzwonić pod 800 70 2222 (Centrum Wsparcia, całą dobę, bezpłatnie). Pomogą też znaleźć pomoc blisko Ciebie.\n\n${POMOC}\n\nGdy poczujesz, że to dobry moment na mentoring, możesz zgłosić się ponownie.\n\n${PODPIS}`,
    }),
  },
  {
    key: "nieobecnosc", label: "Nieobecność na rozmowie wstępnej",
    make: (a) => ({
      subject: "Rozmowa wstępna — program POWRÓT",
      body: `${first(a)}, czekałem na Ciebie na naszej rozmowie wstępnej, ale nie udało nam się połączyć.\n\nRozumiem, że różne rzeczy się zdarzają. Jeśli nadal chcesz porozmawiać, odpowiedz na tę wiadomość — wyślę Ci nowy link do wyboru terminu.\n\n${PODPIS}`,
    }),
  },
  {
    key: "powitanie", label: "Powitanie w programie",
    make: (a) => ({
      subject: "Witaj w programie POWRÓT",
      body: `${first(a)}, dziękuję za zaufanie. Cieszę się, że zaczynamy.\n\nCo dalej:\n1. W Twoim koncie na exmortis.pl (Moje konto → Mój POWRÓT) znajdziesz zasady współpracy, wiadomości ze mną i postęp programu.\n2. W zakładce „Umów spotkanie” wybierzesz termin pierwszej sesji. Sesje trwają ${POWROT.lengthLong} i odbywają się online.\n3. Dziennik powrotu i materiały po sesjach będą w „Mojej bibliotece”.\n\nKontakt między sesjami:\n${POWROT_CONTACT.lines.join("\n")}\n\nNa pierwszą sesję nie musisz niczego przygotowywać. Wystarczy spokojne miejsce, kamera i mikrofon.\n\n${PODPIS}`,
    }),
  },
  {
    key: "zakonczenie", label: "Zakończenie programu",
    make: (a) => ({
      subject: "Domknięcie programu POWRÓT",
      body: `${first(a)}, dziękuję za wspólną drogę.\n\nTwój plan dalszej drogi zostaje z Tobą w koncie. Od teraz masz dostęp do Listów powrotu dla absolwentów.\n\nMam jedną prośbę: napisz mi w kilku zdaniach, co ten czas Ci dał, a co mogłem zrobić lepiej. Jeśli zgodzisz się, żebym pokazał Twoją opinię na stronie, napisz też, w jakiej formie — imię, inicjały czy anonimowo. Bez Twojej wyraźnej zgody niczego nie publikuję.\n\nJeśli kiedyś zechcesz wrócić na jedną rozmowę, możesz umówić sesję kontrolną z konta.\n\n${PODPIS}`,
    }),
  },
  {
    key: "wiadomosc", label: "Wiadomość własna",
    make: (a) => ({ subject: "Program POWRÓT", body: `${first(a)},\n\n\n\n${PODPIS}` }),
  },
];

export const INVITE_INTRO = (a) =>
  `${first(a)}, dziękuję za Twoje zgłoszenie i odpowiedzi w ankiecie.\n\nChcę zaprosić Cię na krótką rozmowę, podczas której sprawdzimy, czy program POWRÓT jest dla Ciebie odpowiednią drogą współpracy.\n\nRozmowa trwa około ${ROZMOWA_WSTEPNA.minutes} minut, odbywa się online i jest bezpłatna. Nie jest sesją mentoringową ani terapią.`;
