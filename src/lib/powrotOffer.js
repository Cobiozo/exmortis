// Jedno źródło parametrów programu POWRÓT (potwierdzone przez właściciela 2.11.2026).
// Każde miejsce, które pokazuje te wartości — strona /powrot, zajawka na stronie głównej,
// rejestr treści — bierze je stąd, żeby liczba i cena nie rozjechały się w tekstach.
export const POWROT = {
  price: 7999,
  priceText: "7 999 zł",
  priceFull: "7 999 zł za pełny program",
  sessions: 8,
  sessionsTitle: "Osiem sesji",
  sessionsWord: "osiem sesji",
  months: "4–6 miesięcy",
  cadence: "co 2–3 tygodnie",
  length: "60 min (sesja 1: do 90 min)",
  form: "Zoom",
  start: "styczeń 2027", // wartość ze strony — DO POTWIERDZENIA przez właściciela
  tools: 8,
  toolsLine: "Arsenał 8 narzędzi głębi",
};

export const POWROT_LEAD = `${POWROT.months}. ${POWROT.sessionsTitle}. Jedna decyzja: „chcę wrócić inny.”`;

export const POWROT_TEASER = `Autorski program mentorski exmortis — dla tych, którzy wychodzą ze śmierci mentalnej, duchowej albo życiowej. ${POWROT.months}, cztery etapy, ${POWROT.sessionsWord} jeden na jeden.`;

export const POWROT_HOW_ROWS = [
  { label: "Czas pracy", value: POWROT.months },
  { label: "Sesje", value: `${POWROT.sessions} spotkań · ${POWROT.cadence}` },
  { label: "Długość", value: POWROT.length },
  { label: "Miejsce", value: `Platforma ${POWROT.form}` },
];

export const POWROT_INCLUDES = [
  `${POWROT.sessionsTitle} indywidualnych 1:1`,
  "Twoja własna Mapa powrotu (powstaje w sesji pierwszej)",
  POWROT.toolsLine,
  "Dziennik powrotu z zadaniami między sesjami",
  "Kontakt między sesjami (wiadomości, audio — z granicami)",
  "Domknięcie: osobisty plan „jak nie wrócić do śmierci”",
  "Dostęp do zamkniętej ścieżki „Listów powrotu” tylko dla uczestników programu",
];

export const POWROT_FAQ_PRICE = `${POWROT.priceText} za pełny program (${POWROT.sessions} sesji). Start: ${POWROT.start}.`;