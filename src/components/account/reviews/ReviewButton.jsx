import React, { useState } from "react";
import { Star } from "lucide-react";
import ReviewDialog from "./ReviewDialog";

// „Oceń” przy produkcie w Moim koncie. Gdy opinia już jest, pokazujemy jej stan (bez możliwości edycji treści).
export default function ReviewButton({ item, onSaved }) {
  const [open, setOpen] = useState(false);
  const status = item.status;

  if (status) {
    const label =
      status === "opublikowana" ? "OPINIA OPUBLIKOWANA" : status === "odrzucona" ? "OPINIA NIEPUBLIKOWANA" : "OPINIA CZEKA NA SPRAWDZENIE";
    return <span className="technical text-[9px] text-foreground/45 border hairline px-2 py-1 whitespace-nowrap">{label}</span>;
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="technical text-[9px] px-3 py-1.5 border border-[#C9A24A]/50 gold-text hover:bg-[#C9A24A]/10 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
      >
        <Star className="h-3 w-3" /> OCEŃ
      </button>
      {open && <ReviewDialog item={item} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); onSaved?.(); }} />}
    </>
  );
}