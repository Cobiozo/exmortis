import { useEffect, useState } from "react";
import useSiteSettings from "@/lib/useSiteSettings";
import { useAdminMode } from "@/components/admin/AdminModeContext";
import { useAuth } from "@/lib/AuthContext";

// Przerwa techniczna (dawniej tryb przedpremierowy — te same ustawienia „premiera”: do, wylaczony).
// Goście widzą stronę przerwy; zalogowani klienci i administrator — pełną stronę.
export const SIM_KEY = "exm_sim"; // dawna symulacja daty (nieużywana; klucz zostaje dla zgodności)
export const NO_END = "2099-12-31T22:59:00.000Z"; // przerwa bez godziny końca
export const hasEnd = (until) => !!until && new Date(until).getTime() < new Date(NO_END).getTime();

// Adresy otwarte dla gości w czasie przerwy: dokumenty prawne, kontakt, logowanie i linki z maili
// (potwierdzenia, bilety, karty, rezerwacje, dołączanie do spotkań, powrót z płatności PayU).
const OPEN = ["/kontakt", "/regulamin", "/polityka-prywatnosci", "/polityka-cookies", "/odstapienie",
  "/login", "/register", "/forgot-password", "/reset-password",
  "/listy/potwierdz", "/listy/wypis", "/zmiana-adresu", "/karta", "/bilet", "/rezerwacja/termin", "/rezerwacja/zarzadzaj"];
export const isOpenPath = (pathname, search = "") => {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (OPEN.includes(p) || p.endsWith("/dolacz")) return true;
  // Powrót z PayU (/kasa?payu=done) — klient, który zapłacił przed przerwą, widzi stan zamówienia.
  if (p === "/kasa" && /[?&]payu=/.test(search)) return true;
  return false;
};

// active — przerwa trwa (czas serwera); gated — bieżący widz widzi stronę przerwy.
export default function usePrelaunch() {
  const s = useSiteSettings();
  const { isAdmin, guest, ready } = useAdminMode();
  const { isAuthenticated } = useAuth();
  const [tick, setTick] = useState(0);
  useEffect(() => { const i = setInterval(() => setTick((x) => x + 1), 30000); return () => clearInterval(i); }, []);
  if (!s) return { loading: true, active: false, gated: false };
  const until = new Date(s.premiera.do);
  const active = !s.premiera.wylaczony && Date.now() + (s.offset || 0) < until.getTime();
  // Do czasu sprawdzenia logowania: w czasie przerwy nic nie odsłaniamy (ciemne tło zamiast mignięcia strony).
  if (!ready) return { loading: false, provisional: active, active, gated: active, until, tick };
  const gated = active && (isAdmin ? guest : !isAuthenticated);
  // Kopia ustawień z pamięci przeglądarki: przerwa włączona, ale serwer jeszcze nie potwierdził — czekamy.
  if (!active && !s.confirmed) return { loading: false, provisional: false, active, gated, until, tick };
  return { loading: false, active, gated, until, tick };
}
