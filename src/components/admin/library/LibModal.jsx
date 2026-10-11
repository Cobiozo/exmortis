import React from "react";
import { X } from "lucide-react";

// Proste okno panelu: nagłówek, treść, stopka. Na telefonie zajmuje całą szerokość.
export default function LibModal({ open, onClose, title, children, footer, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/80 p-3 py-8 sm:p-6" onClick={onClose}>
      <div className={`w-full ${wide ? "max-w-3xl" : "max-w-xl"} bg-[#0A0A0B] border hairline`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-4 px-4 sm:px-5 py-4 border-b hairline">
          <h3 className="relic-heading text-lg sm:text-xl">{title}</h3>
          <button onClick={onClose} aria-label="Zamknij" className="text-foreground/50 hover:gold-text"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-4 sm:p-5 space-y-4 max-h-[70vh] overflow-y-auto">{children}</div>
        {footer && <div className="px-4 sm:px-5 py-4 border-t hairline flex flex-wrap gap-3 justify-end">{footer}</div>}
      </div>
    </div>
  );
}