import React from "react";
import { ShieldAlert } from "lucide-react";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { linkPhones } from "@/lib/phones";

// Ramka bezpieczeństwa — wyróżniona informacja (np. telefony zaufania), numery jako linki „zadzwoń”.
// rozmiar „mala”: węższa, mniejszy tekst i odstępy — dyskretna, ale numery nadal widoczne.
export default function SafetyBox({ d }) {
  const small = d.rozmiar === "mala";
  return (
    <div className={`${small ? "max-w-xl p-4 sm:p-5 gap-3" : "max-w-3xl p-6 sm:p-8 gap-5"} mx-auto border border-[#BC1E22]/50 bg-[#BC1E22]/[0.05] flex`}>
      <ShieldAlert className={`${small ? "h-4 w-4 mt-0.5" : "h-6 w-6 mt-1"} shrink-0 blood-text`} />
      <div className="min-w-0">
        {d.tytul && <p className={`technical ${small ? "text-[10px] mb-2" : "text-xs mb-3"} text-[#E8676A]`}>{d.tytul}</p>}
        <div className={`rich-content ${small ? "text-sm leading-relaxed" : "text-base"} text-foreground/90`} dangerouslySetInnerHTML={{ __html: linkPhones(sanitizeHtml(d.tresc || "")) }} />
      </div>
    </div>
  );
}
