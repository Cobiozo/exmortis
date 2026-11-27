import {
  CalendarDays, CalendarClock, Users, Mail, Library, UsersRound, Megaphone, FileText,
  ShoppingBag, Gem, Percent, PenLine, Menu as MenuIcon, Headphones, Mic, Signpost, Newspaper,
  BarChart3, Contact, ListChecks, Settings, Plug, Shield, UserSearch, History, Eye,
} from "lucide-react";

// Menu panelu: te same 27 modułów i ta sama kolejność, co na dawnym pulpicie.
// lib: true — moduł widoczny tylko przy włączonej bibliotece/wiadomościach (jak dotąd).
// preview: true — „Podgląd strony” otwiera stronę z paskiem admina, nie sekcję panelu.
export const NAV_GROUPS = [
  ["Codzienna praca", [
    { key: "spotkania", label: "Spotkania", icon: CalendarDays },
    { key: "rezerwacje", label: "Rezerwacje 1:1", icon: CalendarClock },
    { key: "klienci", label: "Klienci i dostępy", icon: Users },
    { key: "wiadomosci", label: "Wiadomości", icon: Mail, lib: true },
    { key: "biblioteka", label: "Biblioteka", icon: Library, lib: true },
    { key: "grupy", label: "Grupy", icon: UsersRound, lib: true },
    { key: "ogloszenia", label: "Ogłoszenia", icon: Megaphone },
    { key: "powrot", label: "Zgłoszenia POWRÓT", icon: FileText },
    { key: "rozmowa", label: "Rozmowa na progu", icon: FileText },
  ]],
  ["Sklep i treści", [
    { key: "zamowienia", label: "Zamówienia", icon: ShoppingBag },
    { key: "skarbiec", label: "Skarbiec", icon: Gem },
    { key: "rabaty", label: "Kody rabatowe", icon: Percent },
    { key: "tresci", label: "Treści stron", icon: PenLine },
    { key: "menu", label: "Menu i stopka", icon: MenuIcon },
    { key: "cisza", label: "Cisza", icon: Headphones },
    { key: "glos", label: "Głos (podcast i muzyka)", icon: Mic },
    { key: "rozdroza", label: "Rozdroża", icon: Signpost },
    { key: "newsletter", label: "Newsletter", icon: Newspaper },
  ]],
  ["Dane i wyniki", [
    { key: "statystyki", label: "Statystyki", icon: BarChart3 },
    { key: "kontakty", label: "Baza kontaktów", icon: Contact },
    { key: "testy", label: "Ukończenia testu", icon: ListChecks },
  ]],
  ["Ustawienia i bezpieczeństwo", [
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
