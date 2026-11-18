import React from "react";

// Pasek postępu nad kartą pytania: „Pytanie 3 z 16” i pasek z aria-valuenow.
// Bez animacji przy prefers-reduced-motion (klasa motion-reduce).
export default function TestProgress({ step, total }) {
  const pct = Math.round((step / total) * 100);
  return (
    <div className="mb-6">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <p className="technical text-[11px] text-exm-muted">
          Pytanie {step} z {total}
        </p>
        <p className="technical text-[11px] text-exm-gold" aria-hidden="true">
          {pct}%
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="Postęp testu"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={step}
        aria-valuetext={`Pytanie ${step} z ${total}`}
        className="h-1 w-full overflow-hidden rounded-full bg-exm-line-strong"
      >
        <div
          className="h-full rounded-full bg-exm-gold transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}