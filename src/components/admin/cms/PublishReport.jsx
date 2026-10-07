import React from "react";
import { X } from "lucide-react";

// Wynik walidacji/publikacji: błędy blokują, ostrzeżenia nie.
export default function PublishReport({ report, onClose }) {
  if (!report) return null;
  const { errors = [], warnings = [], ok } = report;
  if (!errors.length && !warnings.length && !ok) return null;
  return (
    <div className="mb-6 border hairline p-5 space-y-3 relative">
      <button onClick={onClose} aria-label="Zamknij" className="absolute top-3 right-3 text-foreground/40"><X className="h-4 w-4" /></button>
      {ok && <p className="gold-text">{ok}</p>}
      {errors.length > 0 && (
        <div><p className="technical text-[10px] blood-text mb-2">PUBLIKACJA ZABLOKOWANA</p>
          <ul className="list-disc ml-5 text-sm space-y-1">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul></div>
      )}
      {warnings.length > 0 && (
        <div><p className="technical text-[10px] gold-text mb-2">OSTRZEŻENIA</p>
          <ul className="list-disc ml-5 text-sm text-foreground/60 space-y-1">{warnings.map((e, i) => <li key={i}>{e}</li>)}</ul></div>
      )}
    </div>
  );
}