import React from "react";
import { cn } from "@/lib/utils";

// Sekcja formularza kasy: tytuł, opcjonalny znacznik „opcjonalnie” i treść.
// Bez numeracji — kolejność wynika z układu, nie z cyfr.
export default function CheckoutSection({ title, optional = false, description, className = "", children }) {
  return (
    <section className={cn("border-t border-exm-line pt-8 first:border-t-0 first:pt-0", className)}>
      <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-exm-serif text-[22px] leading-tight text-exm-ivory">{title}</h2>
        {optional && <span className="technical text-[10px] text-exm-muted">opcjonalnie</span>}
      </div>
      {description && <p className="mb-5 text-[14px] leading-relaxed text-exm-muted">{description}</p>}
      {children}
    </section>
  );
}