import { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { NAV, TEST, FOOTER } from "./navItems";

export const NAV_DEFAULT = { menu: NAV, test: TEST, kolumny: FOOTER };
// „Obok” nie ma pozycji w menu głównym — wejście z konta (zakładka Obok) i z zapowiedzi na stronie głównej.
const noObok = (menu) => menu.filter((m) => !String(m.to).startsWith("/obok"));

// Menu i stopka z edytora (jeden rekord SiteNav); domyślne wartości do czasu zapisu.
// Podgląd szkicu w edytorze: nadpisuje opublikowane menu i stopkę.
export const NavDraftContext = createContext(null);

export function useSiteNav() {
  const draft = useContext(NavDraftContext);
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
    menu: noObok(menu),
    test: data?.test?.label ? data.test : TEST,
    kolumny: data?.kolumny?.length ? data.kolumny : FOOTER,
  };
}