import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import SummaryCard from "./SummaryCard";

// Telefon: podsumowanie zwinięte w pasku „Podsumowanie · kwota”, rozwijane przyciskiem.
// Bez przyklejania do dołu — pola formularza muszą zostać widoczne.
export default function CheckoutSummaryBar(props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="podsumowanie-kasy"
        className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-[var(--exm-r-field)] border border-exm-line bg-exm-surface px-4 py-3 text-left"
      >
        <span className="text-[14px] text-exm-ivory">
          Podsumowanie · <span className="text-exm-gold">{props.sumPl} zł</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-exm-muted transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div id="podsumowanie-kasy" className="mt-3">
          {/* Informacje o dostarczeniu i dostępie są w formularzu, nad oświadczeniami — bez powtarzania ich tutaj. */}
          <SummaryCard {...props} withInfo={false} />
        </div>
      )}
    </div>
  );
}