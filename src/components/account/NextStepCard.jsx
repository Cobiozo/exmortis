import React from "react";
import { Link } from "react-router-dom";

// „Następny krok” — polecany materiał (myAccount → products → next). Wygląd 16.11.2026.
export default function NextStepCard({ step, className = "" }) {
  if (!step) return null;
  return (
    <section aria-label="Następny krok" className={`rounded-2xl border border-[#C9A24A]/30 p-5 md:p-6 flex flex-col gap-2 ${className}`}
      style={{ background: "linear-gradient(180deg, rgba(201,162,74,.07), rgba(201,162,74,0))" }}>
      <p className="technical text-[10px] gold-text">NASTĘPNY KROK</p>
      <p className="shop-heading text-2xl text-[#F5EFE1] leading-tight">{step.name}</p>
      {step.text && <p className="text-sm text-[#F5EFE1]/70">{step.text}</p>}
      <div className="mt-auto pt-3">
        <Link to={step.href || `/skarbiec/${step.slug}`}
          className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-lg bg-[#C9A24A] text-[#0A0A0B] text-sm font-semibold hover:bg-[#E2C27A] transition-colors">
          {step.fallback === "free" ? "Pobierz materiał" : "Zobacz materiał"}
        </Link>
      </div>
    </section>
  );
}
