import React from "react";
import { fallbackFresh } from "@/content/joinFallback";

export const STALE_TEXT = "Kopia awaryjna /dolacz jest starsza niż dane spotkania — odświeży się sama przy najbliższej publikacji strony. Do tego czasu osoby, które otworzyły stronę spotkania, mają aktualną kopię w swojej przeglądarce";

// Znacznik przy spotkaniu: czy wbudowana kopia (strona /dolacz bez serwera) zgadza się z danymi.
export default function FallbackBadge({ ev }) {
  const fresh = fallbackFresh(ev);
  if (fresh === null) return null;
  return fresh
    ? <p className="technical text-[9px] text-foreground/40 mt-1">DANE AWARYJNE AKTUALNE</p>
    : <p className="text-xs text-foreground/55 mt-1">{STALE_TEXT}</p>;
}