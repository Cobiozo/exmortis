import { useEffect, useState } from "react";
import useSiteSettings from "@/lib/useSiteSettings";
import { useAdminMode } from "@/components/admin/AdminModeContext";

export const SIM_KEY = "exm_sim"; // symulowana data (tylko admin, w karcie)
export const PRELAUNCH_OPEN = ["/", "/1-listopada", "/kontakt", "/regulamin", "/polityka-prywatnosci", "/polityka-cookies", "/odstapienie",
  "/login", "/forgot-password", "/reset-password"];
// Adresy, które w trybie przedpremierowym przekierowują na zapowiedź (reszta nieznanych → 404).
export const PRELAUNCH_HIDDEN = ["/o-mnie", "/powrot", "/skarbiec", "/sklep", "/produkt", "/kasa", "/glos", "/test", "/spotkania", "/cisza", "/strona", "/konto", "/register"];

// active — tryb trwa (czas serwera); gated — bieżący widz widzi tylko zapowiedź.
export default function usePrelaunch() {
  const s = useSiteSettings();
  const { isAdmin, guest, ready } = useAdminMode();
  const [tick, setTick] = useState(0);
  useEffect(() => { const i = setInterval(() => setTick((x) => x + 1), 30000); return () => clearInterval(i); }, []);
  if (!s || !ready) return { loading: true, active: false, gated: false };
  const sim = isAdmin && sessionStorage.getItem(SIM_KEY);
  const now = sim ? new Date(sim).getTime() : Date.now() + (s.offset || 0);
  const until = new Date(s.premiera.do);
  const active = !s.premiera.wylaczony && now < until.getTime();
  return { loading: false, active, gated: active && (!isAdmin || guest), until, sim: sim || null, tick };
}

export const isHiddenPath = (p) => PRELAUNCH_HIDDEN.some((h) => p === h || p.startsWith(h + "/"));