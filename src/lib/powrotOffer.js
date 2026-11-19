// Jedno źródło parametrów oferty mentoringowej (POWRÓT, Rozmowa na progu, rozmowa wstępna, sesja kontrolna).
// Parametry potwierdzone przez właściciela 2.11.2026 i 17–18.11.2026 (master prompt POWRÓT v2).
// Każde miejsce, które pokazuje te wartości — strona /powrot, zajawka na stronie głównej, panel,
// rejestr treści — bierze je stąd, żeby liczby i ceny nie rozjechały się w tekstach.
export const POWROT = {
  price: 7999,
  priceText: "7 999 zł",
  priceFull: "7 999 zł za pełny program",
  installments: "Możliwa płatność w ratach przez PayU, jeśli operator udostępni ją dla Twojej płatności. O przyznaniu i warunkach rat decyduje instytucja finansująca.",
  installmentsShort: "możliwa płatność w ratach przez PayU",
  sessions: 8,
  sessionsTitle: "Osiem sesji",
  sessionsWord: "osiem sesji",
  months: "4–6 miesięcy",
  cadence: "co 2–3 tygodnie",
  length: "90 min",
  lengthLong: "90 minut",
  form: "Zoom",
  start: "styczeń 2027", // potwierdzony przez właściciela 2.11.2026
  capacity: 4, // najwyżej tylu uczestników prowadzę jednocześnie (18.11.2026)
  responseHours: 72, // odpowiedź na zgłoszenie
  pauseWeeks: 8, // maksymalne wstrzymanie programu z ważnych przyczyn
  validMonths: 9, // wszystkie sesje w ciągu 9 miesięcy od pierwszej (plus uzgodnione przerwy)
  tools: 8,
  toolsLine: "8 ćwiczeń i narzędzi pracy — po jednym na każdą sesję",
};

// Kontakt między sesjami (18.11.2026): jedna forma głosowa tygodniowo + wiadomości pisemne w koncie.
export const POWROT_CONTACT = {
  voiceMinutes: 10,
  writtenPerWeek: 2,
  replyHours: 48,
  lines: [
    "Raz w tygodniu wiadomość głosowa do 10 minut albo 10-minutowa rozmowa przez WhatsApp, umawiana wcześniej.",
    "Do 2 wiadomości pisemnych tygodniowo w „Moim koncie”.",
    "Odpowiadam w ciągu 48 godzin w dni robocze.",
    "Kontakt między sesjami nie jest pomocą w nagłych sytuacjach. W kryzysie: 116 123, 800 70 2222, w zagrożeniu życia 112.",
  ],
};

// Pozostałe formy kontaktu — osobne usługi, nie części POWRÓT-u.
export const ROZMOWA_NA_PROGU = { price: 799, priceText: "799 zł", length: "90 minut", slug: "rozmowa-na-progu" };
export const ROZMOWA_WSTEPNA = { minutes: 20, bufferMinutes: 10, weeklyLimit: 15, inviteDays: 7, slug: "rozmowa-kwalifikacyjna" };
export const SESJA_KONTROLNA = { price: 399, priceText: "399 zł", minutes: 60, slug: "sesja-kontrolna" };

export const POWROT_LEAD = `${POWROT.months} · ${POWROT.sessions} sesji po ${POWROT.lengthLong} · indywidualnie, online`;

export const POWROT_TEASER = `Autorski program mentorski exmortis — dla tych, którzy wychodzą ze śmierci mentalnej, duchowej albo życiowej. ${POWROT.months}, cztery etapy, ${POWROT.sessionsWord} indywidualnych.`;

export const POWROT_HOW_ROWS = [
  { label: "Czas pracy", value: POWROT.months },
  { label: "Sesje", value: `${POWROT.sessions} spotkań · ${POWROT.cadence}` },
  { label: "Długość", value: POWROT.length },
  { label: "Miejsce", value: `Platforma ${POWROT.form}` },
];

export const POWROT_INCLUDES = [
  `${POWROT.sessionsTitle.split(" ")[0]} indywidualnych sesji po ${POWROT.lengthLong}, rozłożonych na ${POWROT.months}`,
  "Mapa powrotu: Twój indywidualny plan pracy, który powstaje na pierwszej sesji",
  "Dziennik powrotu: osobisty zeszyt pracy w wersji cyfrowej, z ćwiczeniami i zadaniami między sesjami",
  "Materiały i narzędzia pracy po kolejnych sesjach, w Twoim koncie",
  "Kontakt ze mną między sesjami, w ustalonych granicach",
  "Sesja domykająca: podsumowanie procesu i osobisty plan dalszej drogi",
  "Po programie: zamknięta ścieżka Listów powrotu dla absolwentów",
];

export const POWROT_FAQ_PRICE = `${POWROT.priceText} za pełny program: ${POWROT.sessions} indywidualnych sesji po ${POWROT.lengthLong} i uzgodniony zakres pracy między nimi. ${POWROT.installments} Start najbliższej edycji: ${POWROT.start}.`;
