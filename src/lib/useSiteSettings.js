import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

// Publiczne ustawienia: dane firmy + tryb przedpremierowy + czas serwera (różnica zegarów).
export default function useSiteSettings() {
  const { data } = useQuery({
    queryKey: ["siteSettings"],
    queryFn: async () => {
      const t0 = Date.now();
      const r = (await base44.functions.invoke("siteSettings", {})).data;
      return { ...r, offset: new Date(r.now).getTime() - (t0 + Date.now()) / 2 };
    },
    staleTime: 5 * 60000,
  });
  return data;
}

export const useFirma = () => useSiteSettings()?.firma || {};