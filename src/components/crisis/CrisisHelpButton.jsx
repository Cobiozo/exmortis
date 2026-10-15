import React from "react";
import { useLocation } from "react-router-dom";
import { HeartHandshake } from "lucide-react";
import { useCrisis } from "./CrisisContext";

// Dyskretna etykieta przy dolnej krawędzi. Widoczna na stronach publicznych i w koncie;
// ukryta w panelu admina i na /skaner. Nie zasłania treści ani przycisku zakupu/zapisu.
export default function CrisisHelpButton() {
  const { open } = useCrisis();
  const { pathname } = useLocation();
  if (pathname.startsWith("/admin") || pathname.startsWith("/skaner")) return null;
  return (
    <button
      type="button"
      onClick={open}
      aria-haspopup="dialog"
      aria-label="Potrzebuję pomocy teraz — numery pomocowe"
      className="fixed left-3 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] md:bottom-3 z-[80] inline-flex items-center justify-center gap-2 border border-[#3D3D3F] bg-[#0A0A0B]/90 h-11 w-11 md:h-auto md:w-auto rounded-full md:rounded-none md:px-3 md:py-2 text-[11px] tracking-wide text-foreground/70 backdrop-blur transition-colors hover:border-[#C9A24A] hover:text-[#C9A24A] focus:outline-none focus-visible:border-[#C9A24A] focus-visible:ring-2 focus-visible:ring-[#C9A24A]/40"
    >
      <HeartHandshake className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
      <span className="hidden md:inline">Potrzebuję pomocy teraz</span>
    </button>
  );
}