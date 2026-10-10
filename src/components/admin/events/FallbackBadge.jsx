import React from "react";
import { fallbackFresh } from "@/content/joinFallback";

export const STALE_TEXT = "Dane awaryjne nieaktualne — poproś w czacie o odświeżenie danych awaryjnych i opublikuj stronę";

// Znacznik przy spotkaniu: czy wbudowana kopia (strona /dolacz bez serwera) zgadza się z danymi.
export default function FallbackBadge({ ev }) {
  const fresh = fallbackFresh(ev);
  if (fresh === null) return null;
  return fresh
    ? <p className="technical text-[9px] text-foreground/40 mt-1">DANE AWARYJNE AKTUALNE</p>
    : <p className="text-xs text-[#E8C547] mt-1">{STALE_TEXT}</p>;
}