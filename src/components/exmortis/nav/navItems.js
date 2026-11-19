// Kanał WhatsApp: adres z jednego źródła (lib/whatsappChannel.js); pusty → pozycji w stopce nie ma.
import { WHATSAPP_CHANNEL } from "@/lib/whatsappChannel";

const WA = String(WHATSAPP_CHANNEL || "").trim();

// Belka (decyzja właściciela 17.11.2026): te same pozycje co wcześniej — O mnie · Powrót · Sklep · Spotkania · Cisza · Głos · Kontakt.
// desktop: false = pozycja tylko w menu rozwijanym (☰). sub = krótki opis pod nazwą w menu rozwijanym
// (19.11.2026: każda pozycja ma opis, żeby lista była równa; bez „1:1” — „praca/mentoring indywidualny”).
export const NAV = [
  { label: "O mnie", to: "/o-mnie", sub: "Moja historia i droga" },
  { label: "Powrót", to: "/powrot", sub: "Program mentoringu indywidualnego" },
  { label: "Sklep", to: "/skarbiec", sub: "Książki, materiały i sesje" },
  { label: "Spotkania", to: "/spotkania?src=nav", sub: "Wieczory online na żywo" },
  { label: "Cisza", to: "/cisza", sub: "Minutnik chwili ciszy" },
  { label: "Głos", to: "/glos", sub: "Podcast i muzyka" },
  { label: "Kontakt", to: "/kontakt", sub: "Odpowiadam osobiście" },
  { label: "Zacznij bezpłatnie", to: "/zacznij?src=nav", sub: "Materiały na pierwszy krok", desktop: false },
];
// Opis domyślny dla pozycji z edytora menu (edytor nie ma pola opisu) — po ścieżce.
export const subFor = (n) => n.sub || (NAV.find((d) => d.to.split("?")[0] === String(n.to || "").split("?")[0]) || {}).sub || "";
// 19.11.2026: w belce krótko „Test” (jak pozostałe pozycje).
export const TEST = { label: "Test", to: "/test?src=nav" };

const col = (title, links) => ({ title, links: links.map(([label, to]) => ({ label, to })) });
// Stopka (5.11.2026): Odkrywaj · EXMORTIS · Bądźmy w kontakcie. Parametry ?src=footer zostają (pomiar źródła).
export const FOOTER = [
  col("Odkrywaj", [["Zacznij bezpłatnie", "/zacznij?src=footer"], ["Skarbiec", "/skarbiec?src=footer"], ["Powrót — mentoring", "/powrot"], ["Spotkania", "/spotkania?src=footer"],
    ["Głos — podcast i muzyka", "/glos?src=footer"], ["Chwila ciszy", "/cisza?src=footer"], ["Test autorefleksji", "/test?src=footer"]]),
  col("EXMORTIS", [["Strona główna", "/"], ["O mnie", "/o-mnie"], ["Manifest", "/#manifest"], ["Moje konto", "/konto"], ["Napisz wiadomość", "/kontakt"]]),
  col("Bądźmy w kontakcie", [["kontakt@exmortis.pl", "mailto:kontakt@exmortis.pl"], ["Instagram", "https://www.instagram.com/e.x.m.o.r.t.i.s/"],
    ["Facebook", "https://www.facebook.com/dawidkowalczyk.exmortis"], ["YouTube", "https://www.youtube.com/@e.x.m.o.r.t.i.s"], ...(WA ? [["Kanał WhatsApp", WA]] : [])]),
];
// Dawny układ kolumn (do 5.11.2026). Zapis w panelu identyczny z nim traktujemy jak „nieedytowany”
// i pokazujemy nowy układ (decyzja właściciela 5.11.2026). Własne zmiany z panelu zostają.
export const FOOTER_OLD_TITLES = ["Skarbiec", "Słuchaj", "Poznaj", "Kontakt"];


export const isActive = (pathname, to) => {
  const p = to.split("?")[0];
  return pathname === p || pathname.startsWith(p + "/");
};