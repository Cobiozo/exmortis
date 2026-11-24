import React from "react";
import { SOURCE_LABEL } from "@/components/exmortis/glos/musicUtils";

const TONE = {
  audio: "border-[#C9A24A]/50 text-[#C9A24A]",
  youtube: "border-white/20 text-foreground/70",
  brak: "border-[#E24449]/60 text-[#E24449]",
};

// Źródło utworu: własne audio, tylko YouTube albo brak dostępnego audio.
export default function SourceBadge({ src }) {
  return <span className={`shrink-0 border px-2 py-0.5 text-[11px] ${TONE[src]}`}>{SOURCE_LABEL[src]}</span>;
}