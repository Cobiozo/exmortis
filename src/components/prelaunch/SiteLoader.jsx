import React from "react";
import Logo from "@/components/exmortis/Logo";

// Ekran ładowania do czasu wczytania ustawień — bez menu, żeby nie mignęło pełne menu.
export default function SiteLoader() {
  return (
    <div className="fixed inset-0 z-[60] bg-[#0A0A0B] flex items-center justify-center" role="status" aria-label="Wczytywanie">
      <Logo className="h-16 w-16 breathe" glow={false} />
    </div>
  );
}