import React from "react";
import { HeartHandshake } from "lucide-react";
import { CRISIS_NUMBERS, CRISIS_REMINDER } from "@/components/crisis/CrisisDialog";

// Zwarty pas pomocy w kryzysie pod formularzem kontaktowym (etap 8, 18.11.2026).
// Numery i przypomnienie pochodzą z okna pomocy (CrisisDialog) — ta sama treść, jedno źródło.
export default function KontaktCrisis() {
  return (
    <section
      aria-labelledby="pomoc-kryzys"
      className="mt-12 rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface-2 p-6 md:p-8"
    >
      <div className="flex items-start gap-3">
        <HeartHandshake className="mt-0.5 h-5 w-5 shrink-0 text-exm-gold" strokeWidth={1.5} aria-hidden="true" />
        <div className="min-w-0">
          <h2 id="pomoc-kryzys" className="text-[15px] font-medium text-exm-ivory">Pomoc w kryzysie</h2>
          <p className="mt-1 max-w-[70ch] text-[13px] leading-relaxed text-exm-muted">{CRISIS_REMINDER}</p>
        </div>
      </div>
      <ul className="mt-5 grid gap-3 sm:grid-cols-3">
        {CRISIS_NUMBERS.map((n) => (
          <li key={n.tel}>
            <a
              href={`tel:${n.tel}`}
              className="flex min-h-[48px] flex-col justify-center rounded-[var(--exm-r-field)] border border-exm-line bg-exm-bg px-4 py-3 transition-colors hover:border-exm-gold-line"
            >
              <span className="font-exm-label text-[17px] text-exm-gold">{n.label}</span>
              <span className="mt-1 text-[12px] leading-snug text-exm-muted">{n.desc}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}