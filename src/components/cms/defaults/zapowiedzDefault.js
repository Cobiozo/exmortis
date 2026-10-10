import { LAYOUT_DEFAULT as L } from "../blockTypes";

// Strona główna — zapowiedź (webinar 1.11 o 20:00).
export const ZAPOWIEDZ_BLOCKS = [
  { id: "zap-hero", typ: "hero", widoczny: true, uklad: { ...L, numer: "brak" }, dane: { wariant: "znak", etykieta: "1 LISTOPADA · 20:00 (CZASU PL)",
    linia1: "Coś się zaczyna", linia2: "1 listopada.", lead: "Dla ludzi, którzy funkcjonują, ale przestali żyć.",
    podlead: "Jedno spotkanie na żywo, w dzień, w którym myślimy o tych, których już nie ma. Tym razem o nas, którzy jeszcze jesteśmy, ale trochę umarliśmy.",
    przyciski: [{ etykieta: "Zapisz się na 1 listopada", link: "/1-listopada", styl: "zloty", strzalka: true }], przyciemnienie: 60 } },
  { id: "zap-ramka", typ: "ramka", widoczny: true, uklad: { ...L, szerokosc: "waska", numer: "brak" }, dane: { tytul: "JEŚLI JEST CI BARDZO CIĘŻKO",
    tresc: "<p>exmortis to mentoring, nie terapia. Zadzwoń pod <strong>116 123</strong> lub <strong>800 70 2222</strong> (całą dobę, bezpłatnie). W zagrożeniu życia: <strong>112</strong>.</p>" } },
];