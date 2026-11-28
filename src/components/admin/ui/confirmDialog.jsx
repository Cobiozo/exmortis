import React, { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { AlertTriangle, HelpCircle } from "lucide-react";

// Okno potwierdzenia w stylu panelu (28.11.2026) — zamiast systemowego window.confirm.
// Użycie: if (!(await confirmDialog("Usunąć produkt „X”? Tej operacji nie da się cofnąć."))) return;
// Działania nieodwracalne (usuń, anuluj, odbierz, wyślij…) dostają czerwony przycisk.
const DANGER = /(usun|usuń|anulow|odebra|wycofa|nie da si[eę] cofn|nie mo[żz]na cofn|na sta[łl]e)/i;

function Dialog({ message, confirmLabel, onClose }) {
  const ok = useRef(null);
  const danger = DANGER.test(message);
  useEffect(() => {
    ok.current?.focus();
    const key = (e) => { if (e.key === "Escape") onClose(false); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const Icon = danger ? AlertTriangle : HelpCircle;
  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-label="Potwierdzenie">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => onClose(false)} />
      <div className="relative w-full max-w-md rounded-xl border border-[#3D3D3F] bg-[#0F0F10] p-6 shadow-2xl">
        <div className="flex gap-3">
          <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${danger ? "text-[#E07A6A]" : "text-[#C9A24A]"}`} aria-hidden="true" />
          <p className="text-[15px] leading-relaxed text-[#E2E2E2] whitespace-pre-line [overflow-wrap:anywhere]">{message}</p>
        </div>
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button type="button" onClick={() => onClose(false)} className="min-h-[42px] px-4 rounded-md border border-[#3D3D3F] text-sm text-[#E2E2E2]/80 hover:border-[#C9A24A]">Anuluj</button>
          <button ref={ok} type="button" onClick={() => onClose(true)}
            className={`min-h-[42px] px-4 rounded-md text-sm font-semibold ${danger ? "bg-[#B3261E] text-white hover:bg-[#C93A31]" : "bg-[#C9A24A] text-[#0A0A0B] hover:bg-[#E2C27A]"}`}>
            {confirmLabel || (danger ? "Tak, wykonaj" : "Tak")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function confirmDialog(message, confirmLabel) {
  return new Promise((resolve) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const close = (v) => { root.unmount(); host.remove(); resolve(v); };
    root.render(<Dialog message={String(message || "")} confirmLabel={confirmLabel} onClose={close} />);
  });
}

// Komunikat zamiast window.alert — to samo okno z jednym przyciskiem „OK”.
export function alertDialog(message) {
  return new Promise((resolve) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const close = () => { root.unmount(); host.remove(); resolve(); };
    root.render(
      <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4" role="alertdialog" aria-modal="true">
        <div className="absolute inset-0 bg-black/70" onClick={close} />
        <div className="relative w-full max-w-md rounded-xl border border-[#3D3D3F] bg-[#0F0F10] p-6">
          <p className="text-[15px] leading-relaxed text-[#E2E2E2] whitespace-pre-line">{String(message || "")}</p>
          <div className="mt-6 flex justify-end"><button type="button" autoFocus onClick={close} className="min-h-[42px] px-5 rounded-md bg-[#C9A24A] text-[#0A0A0B] text-sm font-semibold">OK</button></div>
        </div>
      </div>
    );
  });
}
