import { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { NAV, TEST, FOOTER } from "./navItems";

export const NAV_DEFAULT = { menu: NAV, test: TEST, kolumny: FOOTER };
const OBOK = { label: "Obok", to: "/obok" };

// „Obok” tylko dla zalogowanych — zaraz po Skarbcu.
const withObok = (menu) => {
  if (menu.some((m) => m.to === "/obok")) return menu;
  const i = menu.findIndex((m) => String(m.to).startsWith("/skarbiec"));
  return i < 0 ? [...menu, OBOK] : [...menu.slice(0, i + 1), OBOK, ...menu.slice(i + 1)];
};

// Menu i stopka z edytora (jeden rekord SiteNav); domyślne wartości do czasu zapisu.
// Podgląd szkicu w edytorze: nadpisuje opublikowane menu i stopkę.
export const NavDraftContext = createContext(null);

export function useSiteNav() {
  const draft = useContext(NavDraftContext);
  const { isAuthenticated } = useAuth();
  const { data } = useQuery({
    enabled: !draft,
    queryKey: ["siteNav"],
    queryFn: async () => (await base44.entities.SiteNav.list("-updated_date", 1))[0] || null,
    staleTime: 60000,
  });
  if (draft) return { record: null, ...draft };
  const menu = data?.menu?.length ? data.menu : NAV;
  return {
    record: data,
    menu: isAuthenticated ? withObok(menu) : menu.filter((m) => m.to !== "/obok"),
    test: data?.test?.label ? data.test : TEST,
    kolumny: data?.kolumny?.length ? data.kolumny : FOOTER,
  };
}