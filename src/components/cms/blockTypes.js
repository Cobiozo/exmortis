import { Crown, AlignLeft, Columns2, Image as ImageIcon, MousePointerClick, Quote, ListOrdered, LayoutGrid, HelpCircle, Minus, Puzzle, Rows3, Images, Video, CalendarCheck, ShieldAlert, Megaphone } from "lucide-react";

const IMG_RATIOS = [["1:1", "1:1"], ["4:5", "4:5"], ["3:2", "3:2"], ["16:9", "16:9"], ["21:9", "21:9"]];
const HEAD = [
  { k: "etykieta", label: "Etykieta (np. MANIFEST)", typ: "text", max: 30 },
  { k: "tytul", label: "Nagłówek (Enter = nowa linia)", typ: "textarea", max: 40 },
];

// Definicje typów bloków: pola formularza i wartości domyślne.
// bare — blok sam rysuje swoją sekcję (bez ustawień tła/odstępów).
export const TYPES = {
  hero: { label: "Nagłówek strony", icon: Crown, opis: "Etykieta, nagłówek w dwóch liniach, lead, przyciski, tło.", bare: true,
    fields: [
      { k: "wariant", label: "Wariant", typ: "select", opcje: [["standard", "Standardowy"], ["znak", "Ze znakiem exmortis (pełny ekran)"]] },
      { k: "etykieta", label: "Etykieta", typ: "text", max: 30 },
      { k: "linia1", label: "Nagłówek — linia 1 (kremowa)", typ: "text", max: 40 },
      { k: "linia2", label: "Nagłówek — linia 2 (złota)", typ: "text", max: 40 },
      { k: "lead", label: "Lead", typ: "textarea", max: 160 },
      { k: "podlead", label: "Tekst pod leadem", typ: "textarea", max: 200 },
      { k: "przyciski", label: "Przyciski (0–2)", typ: "buttons", maxItems: 2 },
      { k: "przyciski_pion", label: "Przyciski jeden pod drugim", typ: "toggle" },
      { k: "zapowiedz", label: "Informacja nad przyciskami (np. ZAPISY RUSZAJĄ 16 PAŹDZIERNIKA)", typ: "text", max: 50 },
      { k: "zapowiedz_do", label: "Informacja znika (czas polski; puste = zawsze widoczna)", typ: "datetime" },
      { k: "dopisek", label: "Dopisek pod przyciskami", typ: "text", max: 60 },
      { k: "tlo", label: "Zdjęcie tła", typ: "image", noAlt: true },
      { k: "przyciemnienie", label: "Przyciemnienie tła (%)", typ: "number", min: 0, max: 95 },
    ],
    defaults: { wariant: "standard", etykieta: "", linia1: "Nowy nagłówek", linia2: "", lead: "", przyciski: [], przyciemnienie: 60 } },
  tekst: { label: "Tekst", icon: AlignLeft, opis: "Formatowany tekst z nagłówkiem.",
    fields: [...HEAD, { k: "tresc", label: "Treść", typ: "rich" }], defaults: { tytul: "", tresc: "<p>Nowy tekst.</p>" } },
  tekst_zdjecie: { label: "Tekst + zdjęcie", icon: Columns2, opis: "Zdjęcie po lewej lub prawej, obok tekst.",
    fields: [...HEAD, { k: "tresc", label: "Treść", typ: "rich" }, { k: "zdjecie", label: "Zdjęcie", typ: "image" },
      { k: "strona", label: "Zdjęcie", typ: "select", opcje: [["lewo", "Po lewej"], ["prawo", "Po prawej"]] },
      { k: "kolumny", label: "Układ kolumn (zdjęcie–tekst)", typ: "select", opcje: [["50-50", "50 / 50"], ["60-40", "60 / 40 (większe zdjęcie)"], ["40-60", "40 / 60 (więcej tekstu)"]] },
      { k: "proporcja", label: "Proporcja zdjęcia", typ: "select", opcje: IMG_RATIOS },
      { k: "mobile", label: "Na telefonie", typ: "select", opcje: [["gora", "Zdjęcie nad tekstem"], ["dol", "Zdjęcie pod tekstem"]] },
      { k: "podpis", label: "Podpis zdjęcia", typ: "text" }, { k: "przyciski", label: "Przyciski", typ: "buttons", maxItems: 2 }],
    defaults: { tytul: "Nagłówek", tresc: "<p>Tekst obok zdjęcia.</p>", strona: "lewo", kolumny: "50-50", proporcja: "4:5", mobile: "gora", przyciski: [] } },
  cta: { label: "Wezwanie do działania (CTA)", icon: Megaphone, opis: "Wyśrodkowany nagłówek, krótki tekst i przyciski.",
    fields: [...HEAD, { k: "tekst", label: "Tekst", typ: "textarea", max: 240 }, { k: "przyciski", label: "Przyciski (1–2)", typ: "buttons", maxItems: 2 }],
    defaults: { etykieta: "PIERWSZY RUCH", tytul: "Gotowość nie jest warunkiem.", tekst: "", przyciski: [{ etykieta: "Zrób test", link: "/test", styl: "zloty", strzalka: true }] } },
  zdjecie: { label: "Zdjęcie", icon: ImageIcon, opis: "Jedno zdjęcie w kontenerze lub na całą szerokość.",
    fields: [{ k: "zdjecie", label: "Zdjęcie", typ: "image" }, { k: "proporcja", label: "Proporcja", typ: "select", opcje: IMG_RATIOS }, { k: "podpis", label: "Podpis", typ: "text" }],
    defaults: { proporcja: "16:9" } },
  przyciski: { label: "Przyciski", icon: MousePointerClick, opis: "1–3 przyciski w stylu marki.",
    fields: [{ k: "przyciski", label: "Przyciski (1–3)", typ: "buttons", maxItems: 3 }],
    defaults: { przyciski: [{ etykieta: "Zrób test", link: "/test", styl: "zloty", strzalka: true }] } },
  cytat: { label: "Cytat", icon: Quote, opis: "Duży cytat szeryfowym krojem z podpisem.",
    fields: [{ k: "tekst", label: "Cytat", typ: "textarea", max: 220 }, { k: "podpis", label: "Podpis", typ: "text" }],
    defaults: { tekst: "„Nowy cytat.”", podpis: "" } },
  linie: { label: "Lista zdań (manifest)", icon: Rows3, opis: "Kolejne zdania dużym krojem, jedno wyróżnione.", spine: true,
    fields: [{ k: "etykieta", label: "Etykieta", typ: "text", max: 30 }, { k: "linie", label: "Zdania", typ: "lines" },
      { k: "akcent", label: "Które zdanie wyróżnić (numer, 0 = żadne)", typ: "number", min: 0, max: 20 }],
    defaults: { etykieta: "", linie: ["Pierwsze zdanie."], akcent: 0 } },
  etapy: { label: "Etapy / lista punktów", icon: ListOrdered, opis: "2–8 numerowanych punktów: tytuł i opis.",
    fields: [...HEAD, { k: "uklad", label: "Układ", typ: "select", opcje: [["poziomy", "Poziomy"], ["pionowy", "Pionowy"]] },
      { k: "elementy", label: "Punkty", typ: "items", maxItems: 8, sub: [{ k: "tytul", label: "Tytuł", typ: "text", max: 40 }, { k: "opis", label: "Opis", typ: "textarea" }] }],
    defaults: { tytul: "Etapy", uklad: "poziomy", elementy: [{ tytul: "Śmierć", opis: "" }, { tytul: "Próg", opis: "" }] } },
  karty: { label: "Karty", icon: LayoutGrid, opis: "2–6 kart w siatce: obraz, tytuł, opis, przycisk.",
    fields: [...HEAD, { k: "intro", label: "Tekst obok nagłówka", typ: "textarea" },
      { k: "numerowane", label: "Numery kart (01, 02…)", typ: "toggle" },
      { k: "kolumny", label: "Kolumny", typ: "select", opcje: [["2", "2"], ["3", "3"]] },
      { k: "karty", label: "Karty", typ: "items", maxItems: 6, sub: [{ k: "tytul", label: "Tytuł", typ: "text", max: 40 }, { k: "opis", label: "Opis", typ: "textarea" },
        { k: "obraz", label: "Obraz (opcjonalnie)", typ: "image", optional: true }, { k: "przycisk", label: "Przycisk (opcjonalnie)", typ: "buttons", maxItems: 1 }] }],
    defaults: { tytul: "Karty", kolumny: "3", numerowane: true, karty: [{ tytul: "Pierwsza", opis: "" }, { tytul: "Druga", opis: "" }] } },
  faq: { label: "Pytania i odpowiedzi", icon: HelpCircle, opis: "Rozwijane odpowiedzi (akordeon).",
    fields: [...HEAD, { k: "pytania", label: "Pytania", typ: "items", maxItems: 20, sub: [{ k: "pytanie", label: "Pytanie", typ: "text" }, { k: "odpowiedz", label: "Odpowiedź", typ: "textarea" }] }],
    defaults: { tytul: "Pytania", pytania: [{ pytanie: "Pytanie?", odpowiedz: "Odpowiedź." }] } },
  galeria: { label: "Galeria", icon: Images, opis: "2–12 zdjęć w siatce z podpisami.",
    fields: [...HEAD, { k: "kolumny", label: "Kolumny", typ: "select", opcje: [["3", "3"], ["2", "2"], ["4", "4"]] },
      { k: "zdjecia", label: "Zdjęcia", typ: "items", maxItems: 12, sub: [{ k: "obraz", label: "Zdjęcie", typ: "image" }, { k: "podpis", label: "Podpis", typ: "text" }] }],
    defaults: { tytul: "", kolumny: "3", zdjecia: [] } },
  wideo: { label: "Wideo", icon: Video, opis: "YouTube, Vimeo albo plik MP4.",
    fields: [{ k: "etykieta", label: "Etykieta", typ: "text", max: 30 }, { k: "tytul", label: "Nagłówek (opcjonalnie)", typ: "textarea", max: 60 }, { k: "url", label: "Link do wideo", typ: "text" },
      { k: "proporcja", label: "Proporcja", typ: "select", opcje: [["16:9", "16:9"], ["4:3", "4:3"], ["1:1", "1:1"], ["9:16", "9:16 (pionowe)"]] }, { k: "podpis", label: "Podpis", typ: "text" }],
    defaults: { url: "", proporcja: "16:9" } },
  separator: { label: "Separator", icon: Minus, opis: "Złota kreska albo pusty odstęp.",
    fields: [{ k: "wariant", label: "Wariant", typ: "select", opcje: [["kreska", "Złota kreska"], ["odstep", "Odstęp"]] }], defaults: { wariant: "kreska" } },
  zapis_spotkanie: { label: "Formularz zapisu na spotkanie", icon: CalendarCheck, opis: "Zapis na wybrane spotkanie: e-maile, plik kalendarza, przypomnienia.",
    fields: [{ k: "etykieta", label: "Etykieta", typ: "text", max: 30 }, { k: "tytul", label: "Nagłówek", typ: "textarea", max: 60 },
      { k: "spotkanie", label: "Adres spotkania (z zakładki Spotkania)", typ: "text" },
      { k: "zapisy_od", label: "Formularz widoczny od (czas polski; wcześniej komunikat „Zapisy ruszają…”)", typ: "datetime" }],
    defaults: { etykieta: "ZAPIS", tytul: "Zapisz się", spotkanie: "" } },
  ramka: { label: "Ramka bezpieczeństwa", icon: ShieldAlert, opis: "Wyróżniona informacja, np. telefony zaufania.",
    fields: [{ k: "tytul", label: "Tytuł", typ: "text", max: 50 }, { k: "tresc", label: "Treść", typ: "rich" },
      { k: "rozmiar", label: "Rozmiar", typ: "select", opcje: [["standard", "Standardowa"], ["mala", "Mała (dyskretna)"]] }],
    defaults: { tytul: "JEŚLI JEST CI BARDZO CIĘŻKO", tresc: "<p>Zadzwoń pod <strong>116 123</strong> lub <strong>112</strong>.</p>" } },
  modul: { label: "Moduł dynamiczny", icon: Puzzle, opis: "Spotkania, Skarbiec, newsletter, kontakt i inne moduły.", bare: true,
    fields: [{ k: "modul", label: "Moduł", typ: "module" }, { k: "etykieta", label: "Etykieta (Skarbiec)", typ: "text", max: 30 },
      { k: "tytul", label: "Nagłówek (Skarbiec, Test)", typ: "text", max: 40 }, { k: "tekst", label: "Wstęp (Skarbiec, Test)", typ: "rich" }],
    defaults: { modul: "spotkania" } },
};

export const TYPE_ORDER = Object.keys(TYPES);
export const LAYOUT_DEFAULT = { szerokosc: "standard", wyrownanie: "lewo", tlo: "czern", odstep: "duzy", numer: "auto", urzadzenia: "wszedzie" };

export function newBlock(typ) {
  const t = TYPES[typ];
  return { id: crypto.randomUUID(), typ, widoczny: true, dane: structuredClone(t.defaults),
    uklad: { ...LAYOUT_DEFAULT, numer: t.bare ? "brak" : "auto" } };
}

export const blockName = (b) => {
  const d = b.dane || {};
  return (d.etykieta || d.linia1 || d.tytul || d.tekst || "").replace(/<[^>]+>/g, "").split("\n")[0].slice(0, 40) || TYPES[b.typ]?.label;
};