import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { takeSettings } from "@/lib/prefetch";
import { readCache, writeCache } from "@/lib/swrCache";

// Publiczne ustawienia: dane firmy + tryb przedpremierowy + czas serwera (różnica zegarów).
// Kopia z poprzedniej wizyty renderuje się od razu; serwer odświeża ją w tle.
export default function useSiteSettings() {
  const { data } = useQuery({
    queryKey: ["siteSettings"],
    queryFn: async () => {
      const t0 = Date.now();
      const r = await (takeSettings() || base44.functions.invoke("siteSettings", {}).then((x) => x.data));
      const out = { ...r, offset: new Date(r.now).getTime() - (t0 + Date.now()) / 2, confirmed: true };
      writeCache("settings", out);
      return out;
    },
    initialData: () => { const c = readCache("settings"); return c && { ...c, confirmed: false }; },
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60000,
  });
  return data;
}

export const useFirma = () => useSiteSettings()?.firma || {};