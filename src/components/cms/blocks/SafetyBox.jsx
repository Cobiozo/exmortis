import React from "react";
import { ShieldAlert } from "lucide-react";
import { sanitizeHtml } from "@/lib/sanitizeHtml";

// Ramka bezpieczeństwa — wyróżniona informacja (np. telefony zaufania).
export default function SafetyBox({ d }) {
  return (
    <div className="max-w-3xl mx-auto border border-[#BC1E22]/50 bg-[#BC1E22]/[0.05] p-6 sm:p-8 flex gap-5">
      <ShieldAlert className="h-6 w-6 shrink-0 blood-text mt-1" />
      <div className="min-w-0">
        {d.tytul && <p className="technical text-[11px] blood-text mb-3">{d.tytul}</p>}
        <div className="rich-content text-foreground/75" dangerouslySetInnerHTML={{ __html: sanitizeHtml(d.tresc || "") }} />
      </div>
    </div>
  );
}