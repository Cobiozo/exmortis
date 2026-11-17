// Pytania i opcje szczegółowej ankiety POWRÓT (drugi etap zgłoszenia).
// Nowa redakcja 18.11.2026 (master prompt v2): część A bez danych o zdrowiu,
// część B (wsparcie i zdrowie) nieobowiązkowa i wyłącznie za osobną, wyraźną zgodą (art. 9 ust. 2 lit. a RODO).
import { POWROT } from "@/lib/powrotOffer";

export const AGE_OPTIONS = ["18–25", "26–35", "36–45", "46–55", "56+"];
export const RETURN_FROM = [
  "Wypalenie i przeciążenie",
  "Utrata sensu, wartości lub kierunku",
  "Rozstanie lub zmiana w relacjach",
  "Ważna zmiana życiowa",
  "Utrata roli lub tożsamości",
  "Doświadczenie straty",
  "Inna sytuacja",
  "Jeszcze nie potrafię tego nazwać",
];
export const DURATION_OPTIONS = ["Mniej niż 3 miesiące", "3–12 miesięcy", "1–3 lata", "Dłużej niż 3 lata"];
export const EXPECT_OPTIONS = [
  "Szerszej perspektywy",
  "Uporządkowania ważnych decyzji",
  "Towarzyszenia w procesie zmiany",
  "Pomocy w przełożeniu decyzji na działania",
  "Gotowych instrukcji i rozwiązań",
  "Nie mam jeszcze pewności",
];
export const START_OPTIONS = ["W najbliższym wolnym terminie", "W ciągu 1–3 miesięcy", "Później", "Jeszcze nie wiem"];
export const TIME_OPTIONS = ["Tak", "Prawdopodobnie tak, ale wymaga to organizacji", "Obecnie nie"];
export const INVEST_OPTIONS = ["Tak", "Chcę porozmawiać o formie płatności", "Obecnie nie", "Jeszcze nie wiem"];
export const DECISION_OPTIONS = ["Tak", "Potrzebuję jeszcze ją przemyśleć", "Zgłaszam się głównie za namową innej osoby"];
export const THERAPY_OPTIONS = ["Tak", "Nie", "Wolę nie odpowiadać"];
export const SOURCE_OPTIONS = ["Facebook", "Instagram", "Newsletter «Listy powrotu»", "Podcast", "Otwarte spotkanie", "Polecenie", "Inne"];
export const CONTACT_OPTIONS = ["E-mail", "Telefon", "Obojętnie"];

export const INVEST_LABEL = `Program kosztuje ${POWROT.priceText}, ${POWROT.installmentsShort}. Czy taki koszt jest dla Ciebie realny?`;

// Odpowiedź z etapu 1 („co sprawia, że rozważasz program teraz”) jest wpisana w pole sytuacji.
export const surveyInitial = (situation = "") => ({
  age: "",
  return_from: [],
  return_from_other: "",
  situation,
  duration: "",
  goal: "",
  oczekiwania: [],
  tried_before: "",
  start_kiedy: "",
  weekly_time: "",
  investment: "",
  decyzja: "",
  anything_else: "",
  source: "",
  contact_pref: "",
  consent_paid: false,
  consent_health: false,
  therapy_support: "",
  zdrowie_uwagi: "",
});
