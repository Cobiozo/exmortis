// Kanał WhatsApp: adres z jednego źródła (lib/whatsappChannel.js); pusty → pozycji w stopce nie ma.
import { WHATSAPP_CHANNEL } from "@/lib/whatsappChannel";

const WA = String(WHATSAPP_CHANNEL || "").trim();

// Belka od 17.11.2026 (decyzja właściciela): O mnie · Mentoring (POWRÓT) · Skarbiec · Spotkania · Głos · Kontakt.
// desktop: false = pozycja tylko w menu na telefonie (grupa „Bezpłatnie”). sub = drobny dopisek w menu telefonu.
export const NAV = [
  { label: "O mnie", to: "/o-mnie" },
  { label: "Mentoring", to: "/powrot", sub: "POWRÓT" },
  { label: "Skarbiec", to: "/skarbiec" },
  { label: "Spotkania", to: "/spotkania?src=nav" },
  { label: "Głos", to: "/glos", sub: "podcast i muzyka" },
  { label: "Kontakt", to: "/kontakt" },
  { label: "Zacznij bezpłatnie", to: "/zacznij?src=nav", desktop: false },
  { label: "Cisza", to: "/cisza", sub: "minutnik", desktop: false },
];
export const TEST = { label: "Zrób test", to: "/test?src=nav" };

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