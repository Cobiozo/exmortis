import React from "react";
import { Link } from "react-router-dom";

// Druga ścieżka tuż pod głównym przyciskiem formularza (19.11.2026): „Nie masz konta?” + „Załóż darmowe konto”
// na logowaniu, „Masz już konto?” + „Zaloguj się” na rejestracji — pełnej szerokości, dobrze widoczne.
// Teksty z panelu mogą być zapisane wersalikami — pokazujemy je zdaniem.
const sentence = (s) => {
  const t = String(s || "").trim();
  return t && t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t;
};

export default function AuthSwitch({ question, label, to }) {
  return (
    <div className="mt-6">
      <div className="flex items-center gap-3 text-[13px] text-exm-muted">
        <span className="h-px flex-1 bg-exm-line" aria-hidden="true" />
        <span>{question}</span>
        <span className="h-px flex-1 bg-exm-line" aria-hidden="true" />
      </div>
      <Link to={to} className="btn-ghost mt-4 w-full">{sentence(label)}</Link>
    </div>
  );
}
