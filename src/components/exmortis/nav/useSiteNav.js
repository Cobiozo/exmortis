import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { NAV, TEST, FOOTER } from "./navItems";

export const NAV_DEFAULT = { menu: NAV, test: TEST, kolumny: FOOTER };

// Menu i stopka z edytora (jeden rekord SiteNav); domyślne wartości do czasu zapisu.
export function useSiteNav() {
  const { data } = useQuery({
    queryKey: ["siteNav"],
    queryFn: async () => (await base44.entities.SiteNav.list("-updated_date", 1))[0] || null,
    staleTime: 60000,
  });
  return {
    record: data,
    menu: data?.menu?.length ? data.menu : NAV,
    test: data?.test?.label ? data.test : TEST,
    kolumny: data?.kolumny?.length ? data.kolumny : FOOTER,
  };
}