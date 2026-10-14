import React from "react";
import { plDate, daysLeft } from "./accountUtils";

// Data dostępu na kafelku produktu.
export default function AccessLine({ p }) {
  if (!p.valid_until) return <p className="text-xs text-foreground/55">Dostęp bezterminowy</p>;
  if (!p.active) return <p className="text-xs text-foreground/50">Dostęp wygasł {plDate(p.valid_until)}</p>;
  const d = daysLeft(p.valid_until);
  if (d <= 30) return <p className="text-xs gold-text">Dostęp kończy się za {d} {d === 1 ? "dzień" : "dni"}</p>;
  return <p className="text-xs text-foreground/50">Dostęp do {plDate(p.valid_until)}</p>;
}