import React from "react";

// Spokojne pytanie w stronie, zamiast okienka przeglądarki.
export default function LeaveConfirm({ onStay, onLeave }) {
  return (
    <div role="dialog" aria-label="Przerwać ciszę?" className="absolute top-full mt-3 left-1/2 -translate-x-1/2 z-30 border border-[#C9A24A]/30 bg-[#0A0A0B] px-5 py-3 text-center whitespace-nowrap fade-up">
      <p className="text-sm text-[#F5EFE1]/80 mb-3">Przerwać ciszę?</p>
      <div className="flex gap-5 justify-center text-xs technical">
        <button onClick={onStay} className="gold-text hover:text-[#E2C170]">Zostaję</button>
        <button onClick={onLeave} className="text-foreground/50 hover:text-foreground">Wychodzę</button>
      </div>
    </div>
  );
}