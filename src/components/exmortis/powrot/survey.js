// Pytania i opcje pełnej ankiety POWRÓT (drugi etap zgłoszenia) — bez zmian względem
// dotychczasowego formularza kwalifikacyjnego.
export const AGE_OPTIONS = ["18–25", "26–35", "36–45", "46–55", "56+"];
export const RETURN_FROM = [
  "Wypalenie, zmęczenie, życie na autopilocie",
  "Utrata sensu, pustka, kryzys wiary lub wartości",
  "Rozstanie, rozwód, kryzys w relacji",
  "Żałoba lub strata",
  "Kryzys finansowy lub zawodowy",
  "Choroba (własna lub bliskiej osoby)",
  "Inne",
];
export const DURATION_OPTIONS = ["Mniej niż 3 miesiące", "3–12 miesięcy", "1–3 lata", "Dłużej niż 3 lata"];
export const AREA_OPTIONS = [
  "Zdrowie i energia",
  "Relacje i rodzina",
  "Praca i finanse",
  "Duchowość i sens",
  "Poczucie własnej wartości",
];
export const THERAPY_OPTIONS = ["Tak", "Nie", "Wolę nie odpowiadać"];
export const TIME_OPTIONS = ["Do 1 h", "1–3 h", "Powyżej 3 h"];
export const FORM_OPTIONS = ["W grupie", "Indywidualnie", "Samodzielnie ze wsparciem", "Jeszcze nie wiem"];
export const INVEST_OPTIONS = ["Tak", "Potrzebuję więcej informacji", "Nie w tej chwili"];
export const SOURCE_OPTIONS = ["Facebook", "Instagram", "Newsletter «Listy powrotu»", "Polecenie", "Webinar", "Inne"];
export const CONTACT_OPTIONS = ["E-mail", "Telefon", "Obojętnie"];

// Odpowiedź z etapu 1 („co jest dla Ciebie ważne właśnie teraz”) jest wpisana w pole sytuacji.
export const surveyInitial = (situation = "") => ({
  age: "",
  return_from: [],
  return_from_other: "",
  situation,
  duration: "",
  affected_areas: [],
  tried_before: "",
  therapy_support: "",
  goal: "",
  obstacle: "",
  readiness: null,
  weekly_time: "",
  work_form: "",
  investment: "",
  anything_else: "",
  source: "",
  contact_pref: "",
  consent_health: false,
  consent_terms: false,
  consent_paid: false,
});