import { useEffect, useState } from "react";
import useSiteSettings from "@/lib/useSiteSettings";
import { useAdminMode } from "@/components/admin/AdminModeContext";

const PRE_END = new Date("2026-11-01T20:30:00.000Z").getTime(); // jak PREMIERA_DEFAULT na serwerze
export const SIM_KEY = "exm_sim"; // symulowana data (tylko admin, w karcie)
export const PRELAUNCH_OPEN = ["/", "/1-listopada", "/kontakt", "/regulamin", "/polityka-prywatnosci", "/polityka-cookies", "/odstapienie",
  "/login", "/register", "/forgot-password", "/reset-password"];
// Adresy, które w trybie przedpremierowym przekierowują na zapowiedź (reszta nieznanych → 404).
export const PRELAUNCH_HIDDEN = ["/o-mnie", "/powrot", "/skarbiec", "/sklep", "/produkt", "/kasa", "/glos", "/test", "/spotkania", "/cisza", "/strona", "/konto", "/obok", "/7-wieczorow"];

// active — tryb trwa (czas serwera); gated — bieżący widz widzi tylko zapowiedź.
export default function usePrelaunch() {
  const s = useSiteSettings();
  const { isAdmin, guest, ready } = useAdminMode();
  const [tick, setTick] = useState(0);
  useEffect(() => { const i = setInterval(() => setTick((x) => x + 1), 30000); return () => clearInterval(i); }, []);
  // Pierwsza wizyta, brak odpowiedzi serwera: do premiery od razu widok przedpremierowy (bezpieczny), pełne menu dopiero po potwierdzeniu.
  if (!s) return Date.now() < PRE_END ? { loading: false, provisional: true, active: true, gated: true, until: new Date(PRE_END) } : { loading: true, active: false, gated: false };
  if (!ready && !s.ja_dostep) {
    const until = new Date(s.premiera.do);
    const active = !s.premiera.wylaczony && Date.now() + (s.offset || 0) < until.getTime();
    return { loading: false, provisional: active, active, gated: active, until };
  }
  if (!ready) return { loading: false, provisional: true, active: true, gated: true, until: new Date(s.premiera.do) };
  const sim = isAdmin && sessionStorage.getItem(SIM_KEY);
  const now = sim ? new Date(sim).getTime() : Date.now() + (s.offset || 0);
  const until = new Date(s.premiera.do);
  const active = !s.premiera.wylaczony && now < until.getTime();
  const gated = active && (isAdmin ? guest : !s.ja_dostep);
  // Kopia z pamięci przeglądarki nie odsłania pełnej strony — to robi dopiero odpowiedź serwera.
  if (active && !gated && !s.confirmed) return { loading: false, provisional: true, active, gated: true, until, sim: sim || null, tick };
  return { loading: false, active, gated, until, sim: sim || null, tick };
}

export const isHiddenPath = (p) => PRELAUNCH_HIDDEN.some((h) => p === h || p.startsWith(h + "/"));