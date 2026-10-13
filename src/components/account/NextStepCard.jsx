import React from "react";
import { Link } from "react-router-dom";

export default function NextStepCard({ step }) {
  if (!step) return null;
  return (
    <div className="border hairline p-6 mt-8 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
      <div>
        <p className="technical text-[10px] gold-text mb-2">NASTĘPNY KROK</p>
        <p className="shop-heading text-xl text-[#F5EFE1]">{step.name}</p>
        {step.text && <p className="text-sm text-foreground/60 mt-1">{step.text}</p>}
      </div>
      <Link to={`/skarbiec/${step.slug}`} className="btn-ghost shrink-0">ZOBACZ</Link>
    </div>
  );
}