import {
  Inbox, CalendarDays, CalendarClock, Users, Mail, Library, UsersRound, Megaphone, FileText,
  ShoppingBag, Gem, Percent, PenLine, Menu as MenuIcon, Headphones, Mic, Signpost, Newspaper,
  BarChart3, Contact, Settings, Plug, Shield, UserSearch, History, Eye,
} from "lucide-react";

// Menu panelu.
// lib: true — moduł widoczny tylko przy włączonej bibliotece/wiadomościach (jak dotąd).
// preview: true — „Podgląd strony” otwiera stronę z paskiem admina, nie sekcję panelu.
export const NAV_GROUPS = [
  // Układ według codziennej pracy (28.11.2026): klienci → sprzedaż → praca indywidualna i spotkania → treści → wyniki → ustawienia.
  ["Klienci", [
    { key: "skrzynka", label: "Skrzynka", icon: Inbox },
    { key: "klienci", label: "Klienci i dostępy", icon: Users },
    { key: "kontakty", label: "Baza kontaktów", icon: Contact },
    { key: "newsletter", label: "Newsletter", icon: Newspaper },
    { key: "wiadomosci", label: "Wiadomości w koncie", icon: Mail, lib: true },
  ]],
  ["Sprzedaż", [
    { key: "zamowienia", label: "Zamówienia", icon: ShoppingBag },
    { key: "skarbiec", label: "Skarbiec i pakiety", icon: Gem },
    { key: "rabaty", label: "Kody rabatowe", icon: Percent },
  ]],
  ["Praca indywidualna i spotkania", [
    { key: "spotkania", label: "Spotkania", icon: CalendarDays },
    { key: "rezerwacje", label: "Rezerwacje", icon: CalendarClock },
    { key: "rozmowa", label: "Rozmowa na progu", icon: FileText },
    { key: "powrot", label: "Zgłoszenia POWRÓT", icon: FileText },
  ]],
  ["Treści", [
    { key: "tresci", label: "Treści stron", icon: PenLine },
    { key: "menu", label: "Menu i stopka", icon: MenuIcon },
    { key: "glos", label: "Głos (podcast i muzyka)", icon: Mic },
    { key: "cisza", label: "Cisza", icon: Headphones },
    { key: "rozdroza", label: "Rozdroża", icon: Signpost },
    { key: "ogloszenia", label: "Ogłoszenia i pop-upy", icon: Megaphone },
    { key: "biblioteka", label: "Biblioteka", icon: Library, lib: true },
    { key: "grupy", label: "Grupy", icon: UsersRound, lib: true },
  ]],
  ["Wyniki", [
    { key: "statystyki", label: "Statystyki", icon: BarChart3 },
  ]],
  ["Ustawienia", [
    { key: "ustawienia", label: "Ustawienia strony", icon: Settings },
    { key: "integracje", label: "Integracje", icon: Plug },
    { key: "bezpieczenstwo", label: "Bezpieczeństwo", icon: Shield },
    { key: "dane-osoby", label: "Dane osoby (RODO)", icon: UserSearch },
    { key: "historia", label: "Historia zmian", icon: History, lib: true },
    { key: "podglad", label: "Podgląd strony", icon: Eye, preview: true },
  ]],
];

// Grupy widoczne dla danej roli; rola techniczna widzi tylko swoje moduły.
export function navFor({ tech, techKeys = [], libOn }) {
  return NAV_GROUPS
    .map(([name, items]) => [name, items.filter((i) => (tech ? techKeys.includes(i.key) : (!i.lib || libOn)))])
    .filter(([, items]) => items.length);
}
