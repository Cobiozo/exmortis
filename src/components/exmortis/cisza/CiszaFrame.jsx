import React from "react";
import { Home } from "lucide-react";
import CiszaLogo from "./CiszaLogo";

// Siatka 100dvh: GÓRA logo · ŚRODEK treść · DÓŁ zarezerwowana strefa.
// onHome — wyraźny przycisk powrotu na stronę główną (ekran wyboru i zakończenia; w trakcie sesji go nie ma).
export default function CiszaFrame({ onLogo, onHome, logoExtra, bottom, children, className = "" }) {
  return (
    <section className={`cisza-root fixed inset-0 z-10 grid overflow-hidden ${className}`} style={{ gridTemplateRows: "auto minmax(0,1fr) auto", height: "100dvh" }}>
      <div className="cisza-top relative flex justify-center">
        {onHome && (
          <button type="button" onClick={onHome} aria-label="Wróć na stronę główną"
            className="absolute left-3 sm:left-5 top-[calc(10px+env(safe-area-inset-top))] min-h-11 min-w-11 px-2 inline-flex items-center gap-2 technical text-[11px] text-foreground/70 hover:gold-text transition-colors">
            <Home className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">STRONA GŁÓWNA</span>
          </button>
        )}
        <CiszaLogo onClick={onLogo} />
        {logoExtra}
      </div>
      <div className="relative min-h-0 flex flex-col items-center justify-center px-4">{children}</div>
      <div className="cisza-bottom relative">{bottom}</div>
    </section>
  );
}