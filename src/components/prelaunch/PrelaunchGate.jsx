import React from "react";
import { useLocation } from "react-router-dom";
import usePrelaunch, { isOpenPath } from "@/lib/usePrelaunch";
import Maintenance from "./Maintenance";

// Przerwa techniczna: gość na zamkniętym adresie widzi stronę przerwy (adres zostaje ten sam).
// Otwarte zostają dokumenty prawne, kontakt, logowanie i linki z maili (isOpenPath).
// Zalogowani klienci i administrator widzą pełną stronę; /konto i /admin chroni logowanie jak zawsze.
export default function PrelaunchGate({ children }) {
  const { gated, provisional } = usePrelaunch();
  const { pathname, search } = useLocation();
  if (isOpenPath(pathname, search) || pathname.startsWith("/admin") || pathname.startsWith("/konto")) return children;
  if (provisional) return <div className="min-h-[100svh] bg-[#0A0A0B]" />;
  if (gated) return <Maintenance />;
  return children;
}
