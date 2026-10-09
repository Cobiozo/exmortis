import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

// Jedno pytanie FAQ: przycisk z aria-expanded i odpowiedź.
export default function FaqItem({ q, i }) {
  const [open, setOpen] = useState(false);
  const id = `faq-${i}-${String(q.pytanie || "").length}`;
  return (
    <div className="py-5">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 text-left text-lg min-h-[44px]">
        {q.pytanie}<ChevronDown className={`h-4 w-4 gold-text shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <p id={id} hidden={!open} className="mt-4 text-foreground/70 leading-relaxed whitespace-pre-line">{q.odpowiedz}</p>
    </div>
  );
}