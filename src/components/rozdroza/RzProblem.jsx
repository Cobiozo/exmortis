import React from "react";
import { Link } from "react-router-dom";

// Krótki komunikat zamiast pustego ekranu: „Spróbuj ponownie” i „Wróć do biblioteki”.
export default function RzProblem({ text, onRetry, extra }) {
  return (
    <div role="alert" className="max-w-[680px] mx-auto border hairline p-6 md:p-8">
      <p className="technical text-[10px] text-[#E8676A]">ROZDROŻA</p>
      <p className="text-foreground/80 mt-3 leading-relaxed">{text || "Coś poszło nie tak."}</p>
      <div className="flex flex-wrap gap-3 mt-6">
        {onRetry && <button type="button" onClick={onRetry} className="btn-relic">SPRÓBUJ PONOWNIE</button>}
        {extra}
        <Link to="/konto/rozdroza/biblioteka" className="btn-ghost">WRÓĆ DO BIBLIOTEKI</Link>
      </div>
    </div>
  );
}
