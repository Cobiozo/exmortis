import React from "react";
import EventLine from "@/components/exmortis/powrot/EventLine";

// Najbliższe spotkanie (z modułu Spotkania) w kontenerze strony.
export default function PowrotEventLine() {
  return <div className="px-5 md:px-10"><div className="mx-auto max-w-[1200px]"><div className="max-w-3xl"><EventLine /></div></div></div>;
}