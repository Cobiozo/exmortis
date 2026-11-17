import React from "react";
import { useLocation } from "react-router-dom";
import { HeartHandshake } from "lucide-react";
import { useCrisis } from "./CrisisContext";

// Dyskretna etykieta przy dolnej krawędzi. Widoczna na stronach publicznych i w koncie;
// ukryta w panelu admina, na /skaner, w kasie (na telefonie zasłaniała zgody; numery pomocowe są w stopce)
// i w koncie klienta (16.11.2026, decyzja właściciela: zasłaniała przyciski kart; numery pomocowe w stopce).
export default function CrisisHelpButton() {
  const { open, isOpen } = useCrisis();
  const { pathname } = useLocation();
  if (pathname.startsWith("/admin") || pathname.startsWith("/skaner") || pathname.startsWith("/kasa") || pathname.startsWith("/konto")) return null;
  return (
    <button
      type="button"
      onClick={open}
      aria-haspopup="dialog"
      aria-label="Nagła pomoc — numery pomocowe"
      // Nad przyklejonym dolnym paskiem (zapis, odtwarzacz) — nie zasłania jego przycisku (src/lib/bottomBar.js).
      style={{ bottom: "max(calc(var(--exm-bottom-bar, 0px) + 0.5rem), calc(env(safe-area-inset-bottom) + 0.75rem))" }}
      className={`${isOpen ? "invisible " : ""}fixed left-0 z-[80] inline-flex items-center justify-center gap-1.5 border border-l-0 border-[#3D3D3F] bg-[#0A0A0B]/90 min-h-[36px] pl-2.5 pr-3 py-1.5 rounded-r-full text-[10px] tracking-wide text-foreground/60 backdrop-blur transition-colors hover:border-[#C9A24A] hover:text-[#C9A24A] focus:outline-none focus-visible:border-[#C9A24A] focus-visible:ring-2 focus-visible:ring-[#C9A24A]/40`}
    >
      <HeartHandshake className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
      <span>Nagła pomoc</span>
    </button>
  );
}