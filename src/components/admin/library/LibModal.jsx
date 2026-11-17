import React, { useEffect } from "react";
import { X } from "lucide-react";

// Proste okno panelu: nagłówek, treść, stopka. Stopka zawsze widoczna (treść przewija się pod nią),
// Esc zamyka. Na telefonie okno zajmuje całą szerokość i nie wychodzi poza ekran.
// Otwarte okna (najnowsze na końcu) — Esc zamyka tylko to na wierzchu (np. potwierdzenie nad formularzem).
const STACK = [];

export default function LibModal({ open, onClose, title, children, footer, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    const me = {};
    STACK.push(me);
    const onKey = (e) => { if (e.key === "Escape" && STACK[STACK.length - 1] === me) onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); const i = STACK.indexOf(me); if (i >= 0) STACK.splice(i, 1); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-start sm:items-center justify-center bg-black/80 p-2 sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined}
        className={`w-full ${wide ? "max-w-3xl" : "max-w-xl"} max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-3rem)] flex flex-col bg-[#0A0A0B] border hairline`}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex-none flex items-center justify-between gap-4 px-4 sm:px-5 py-3 sm:py-4 border-b hairline">
          <h3 className="relic-heading text-lg sm:text-xl">{title}</h3>
          <button onClick={onClose} aria-label="Zamknij" className="h-10 w-10 -mr-2 inline-flex items-center justify-center text-foreground/50 hover:gold-text"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 min-h-0 p-4 sm:p-5 space-y-4 overflow-y-auto overscroll-contain">{children}</div>
        {footer && <div className="flex-none px-4 sm:px-5 py-3 sm:py-4 border-t hairline flex flex-wrap items-center gap-2 sm:gap-3 justify-end bg-[#0A0A0B]">{footer}</div>}
      </div>
    </div>
  );
}
