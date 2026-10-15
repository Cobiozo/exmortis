import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { takeSettings, onBoot } from "@/lib/prefetch";
import { readCache, writeCache } from "@/lib/swrCache";

// Publiczne ustawienia: dane firmy + tryb przedpremierowy + czas serwera (różnica zegarów).
// Kopia z poprzedniej wizyty renderuje się od razu; serwer odświeża ją w tle.
const shape = (r, t0) => {
  const out = { ...r, offset: r._cache || !r.now ? readCache("settings")?.offset || 0 : new Date(r.now).getTime() - (t0 + Date.now()) / 2, confirmed: !r._fallback };
  if (!r._fallback) writeCache("settings", out);
  return out;
};

export default function useSiteSettings() {
  const qc = useQueryClient();
  useEffect(() => onBoot((b) => b.settings && qc.setQueryData(["siteSettings"], shape(b.settings, Date.now()))), [qc]);
  const { data } = useQuery({
    queryKey: ["siteSettings"],
    queryFn: async () => {
      const t0 = Date.now();
      return shape(await (takeSettings() || base44.functions.invoke("siteSettings", {}).then((x) => x.data)), t0);
    },
    initialData: () => { const c = readCache("settings"); return c && { ...c, confirmed: false }; },
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60000,
    retry: false,
  });
  return data;
}

// Bez nazwy firmy (np. działalność na własne imię i nazwisko) w tekstach występuje imię i nazwisko.
export const useFirma = () => { const f = useSiteSettings()?.firma || {}; return f.nazwa ? f : { ...f, nazwa: f.osoba || "" }; };