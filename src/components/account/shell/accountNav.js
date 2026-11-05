import { useEffect, useState } from "react";
import { Package, Library, Compass, CalendarDays, CalendarPlus, Mail, Receipt, Settings } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { listStories, cachedList } from "@/components/rozdroza/api";
import { libBundle } from "@/components/account/library/libApi";

// Sekcje panelu konta (oprawa 5.11.2026). Klucze = dotychczasowe ?tab=…; Rozdroża mają własną trasę.
// `when` — warunek widoczności jak dotąd: Biblioteka i Wiadomości wg ustawień modułu, Rozdroża gdy są
// opublikowane historie (administrator widzi je zawsze).
export const SECTIONS = [
  { key: "produkty", label: "Moje produkty", icon: Package, group: "tresci" },
  { key: "biblioteka", label: "Moja biblioteka", icon: Library, group: "tresci", when: (s) => !!s.cfg?.library },
  { key: "rozdroza", label: "Rozdroża", icon: Compass, group: "tresci", to: "/konto/rozdroza", when: (s) => s.rz || s.me?.role === "admin" },
  { key: "spotkania", label: "Spotkania", icon: CalendarDays, group: "spotkania" },
  { key: "sesje", label: "Umów spotkanie", icon: CalendarPlus, group: "spotkania" },
  { key: "wiadomosci", label: "Wiadomości", icon: Mail, group: "spotkania", when: (s) => !!s.cfg?.messages },
  { key: "zakupy", label: "Zakupy", icon: Receipt, group: "konto" },
  { key: "ustawienia", label: "Ustawienia", icon: Settings, group: "konto" },
];

export const GROUPS = [
  ["tresci", "Twoje treści"],
  ["spotkania", "Spotkania i kontakt"],
  ["konto", "Twoje konto"],
];

export const hrefOf = (s) => s.to || `/konto?tab=${s.key}`;
export const visibleSections = (state) => SECTIONS.filter((s) => !s.when || s.when(state));
export const labelOf = (key) => SECTIONS.find((s) => s.key === key)?.label || "";

// Wspólne dane panelu (te same zapytania co wcześniej w /konto): konto, przełączniki modułu, Rozdroża.
export function useAccountState() {
  const [me, setMe] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [rz, setRz] = useState(() => !!cachedList()?.length);
  useEffect(() => {
    base44.auth.me().then(setMe).catch(() => {});
    libBundle().then(setCfg).catch(() => setCfg({ library: false, messages: false }));
    const t = setTimeout(() => listStories().then((l) => l.length && setRz(true)).catch(() => {}), 600);
    return () => clearTimeout(t);
  }, []);
  return { me, cfg, rz };
}
