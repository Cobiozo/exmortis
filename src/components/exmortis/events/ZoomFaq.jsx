import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import useOnlineText from "@/content/useOnlineText";

// Stałe pytania o Zoom pod każdym spotkaniem online (przełącznik w spotkaniu).
export default function ZoomFaq({ event }) {
  const t = useOnlineText();
  const [open, setOpen] = useState(null);
  if (event.format !== "Online" || event.zoom_faq === false) return null;
  const items = [["imie", t("faq.imie.q"), t("faq.imie.a")], ["zoom", t("faq.zoom.q"), t("faq.zoom.a")]];
  return (
    <div className="mt-12 border-t hairline">
      {items.map(([k, q, a]) => (
        <div key={k} className="border-b hairline">
          <button type="button" aria-expanded={open === k} aria-controls={`zfaq-${k}`} onClick={() => setOpen(open === k ? null : k)}
            className="w-full flex items-center justify-between gap-4 py-5 text-left text-[#F5EFE1] hover:text-[#C9A24A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A24A]">
            <span>{q}</span><ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open === k ? "rotate-180" : ""}`} />
          </button>
          {open === k && <p id={`zfaq-${k}`} className="pb-5 text-foreground/70 leading-relaxed">{a}</p>}
        </div>
      ))}
    </div>
  );
}