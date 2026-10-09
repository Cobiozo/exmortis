import { newBlock } from "@/components/cms/blockTypes";

const make = (typ, dane) => { const b = newBlock(typ); b.dane = { ...b.dane, ...dane }; return b; };

// Gotowe sekcje w zakładce „Dodaj”: blok z wypełnioną treścią startową. szkic — miniatura.
export const PRESETS = [
  { key: "faq", nazwa: "Pytania i odpowiedzi", szkic: "faq", blok: () => make("faq", { etykieta: "PYTANIA", tytul: "Zanim zrobisz pierwszy ruch",
    pytania: [{ pytanie: "Czy to terapia?", odpowiedz: "Nie. To droga powrotu, nie leczenie." }, { pytanie: "Czy muszę być gotowy?", odpowiedz: "Nie. Musisz zrobić pierwszy ruch." }] }) },
  { key: "zaproszenie", nazwa: "Zaproszenie na wydarzenie", szkic: "invite", blok: () => make("tekst_zdjecie", { etykieta: "SPOTKANIE", tytul: "Spotkajmy się.",
    tresc: "<p>Jedno spotkanie na żywo. Bez nagrań, bez masek. Zapisz się, a przypomnę Ci dzień wcześniej.</p>", strona: "prawo",
    przyciski: [{ etykieta: "Zapisz się", link: "/spotkania", styl: "zloty", strzalka: true }] }) },
  { key: "tekst_zdjecie", nazwa: "Tekst + zdjęcie", szkic: "split", blok: () => make("tekst_zdjecie", {}) },
  { key: "etapy", nazwa: "Etapy powrotu", szkic: "steps", blok: () => make("etapy", { etykieta: "DROGA", tytul: "Etapy powrotu", elementy: [
    { tytul: "Śmierć", opis: "Nazwanie tego, co umarło." }, { tytul: "Próg", opis: "Moment, w którym przestajesz udawać." },
    { tytul: "Powrót", opis: "Pierwsze ruchy, krok po kroku." }, { tytul: "Życie", opis: "Wracasz inny." }] }) },
  { key: "listy", nazwa: "Zapis na Listy powrotu", szkic: "form", blok: () => make("modul", { modul: "newsletter" }) },
  { key: "cta", nazwa: "Wezwanie do działania (CTA)", szkic: "cta", blok: () => make("cta", {}) },
  { key: "ramka", nazwa: "Ramka bezpieczeństwa", szkic: "box", blok: () => make("ramka", {}) },
];