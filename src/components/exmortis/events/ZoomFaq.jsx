import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import useOnlineText from "@/content/useOnlineText";

// Stałe pytania o dołączenie pod spotkaniem online (przełącznik w spotkaniu).
// Akordeon na przyciskach: Enter i spacja działają natywnie, aria-expanded i aria-controls opisują stan.
export default function ZoomFaq({ event }) {
  const t = useOnlineText();
  const [open, setOpen] = useState(null);
  if (event.format !== "Online" || event.zoom_faq === false) return null;
  const items = [["imie", t("faq.imie.q"), t("faq.imie.a")], ["zoom", t("faq.zoom.q"), t("faq.zoom.a")]];

  return (
    <section aria-labelledby="faq-dolaczenie" className="mt-10">
      <p id="faq-dolaczenie" className="exm-eyebrow mb-2">Pytania o dołączenie</p>
      <div className="border-t border-exm-line">
        {items.map(([k, q, a]) => (
          <div key={k} className="border-b border-exm-line">
            <button
              type="button"
              aria-expanded={open === k}
              aria-controls={`zfaq-${k}`}
              onClick={() => setOpen(open === k ? null : k)}
              className="flex w-full items-center justify-between gap-4 py-5 text-left text-[16px] leading-snug text-exm-ivory transition-colors hover:text-exm-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-exm-gold"
            >
              <span>{q}</span>
              <ChevronDown
                aria-hidden="true"
                className={`h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none ${open === k ? "rotate-180" : ""}`}
              />
            </button>
            {open === k && (
              <p id={`zfaq-${k}`} className="max-w-[62ch] pb-5 leading-relaxed text-exm-muted">{a}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}