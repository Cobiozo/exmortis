import React, { useEffect, useRef } from "react";

// Pytanie w stronie (nie okno przeglądarki) przy wyjściu z niezapisanymi zmianami.
export default function LeaveDialog({ onSave, onLeave, onStay }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
    const k = (e) => e.key === "Escape" && onStay();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onStay]);
  return (
    <div className="fixed inset-0 z-[70] bg-black/80 flex items-end sm:items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="leave-t">
      <div className="w-full max-w-md bg-[#0D0D0E] border hairline p-6 space-y-5">
        <p id="leave-t" className="shop-heading text-2xl text-[#F5EFE1]">Masz niezapisane zmiany</p>
        <div className="flex flex-col gap-2">
          <button ref={ref} type="button" onClick={onSave} className="btn-relic">ZAPISZ SZKIC</button>
          <button type="button" onClick={onLeave} className="btn-ghost hover:!border-[#BC1E22] hover:!text-[#BC1E22]">WYJDŹ BEZ ZAPISU</button>
          <button type="button" onClick={onStay} className="btn-ghost">ZOSTAŃ</button>
        </div>
      </div>
    </div>
  );
}