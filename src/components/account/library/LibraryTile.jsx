import React from "react";
import { Check } from "lucide-react";
import { KIND, mmss, plDate } from "./libApi";

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A24A]";

// Kafelek materiału: tytuł, typ, czas albo liczba stron, etap, notatka, znacznik „Nowe".
export default function LibraryTile({ item, onOpen, onToggleDone }) {
  const meta = [
    item.kind === "AUDIO" && item.duration_s ? mmss(item.duration_s) : null,
    item.kind === "PDF" && item.pages ? `${item.pages} str.` : null,
    item.stage || null,
    item.visible_to ? `do ${plDate(item.visible_to)}` : null,
  ].filter(Boolean);

  return (
    <div className="relative flex flex-col bg-[#0A0A0B] border hairline hover:border-[rgba(201,162,74,.5)] transition-colors">
      {!item.opened_at && (
        <span className="absolute top-0 left-0 bg-[#C9A24A] text-[#0A0A0B] font-mono text-[10px] tracking-[0.16em] uppercase px-2 py-1">Nowe</span>
      )}
      <button type="button" onClick={() => onOpen(item)}
        className={`flex-1 text-left p-5 pt-9 min-h-[44px] ${FOCUS}`}>
        <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-[#C9A24A]">{KIND[item.kind] || item.kind}</p>
        <h3 className="shop-heading text-[19px] leading-snug text-[#F5EFE1] mt-2 break-words">{item.title}</h3>
        {item.description && <p className="font-body text-[14px] leading-relaxed text-foreground/55 mt-2 line-clamp-3">{item.description}</p>}
        {meta.length > 0 && <p className="font-mono text-[11px] text-foreground/45 mt-3">{meta.join(" · ")}</p>}
        {item.note && <p className="font-body text-[13px] leading-relaxed text-[#C9A24A]/80 mt-3 border-l border-[rgba(201,162,74,.4)] pl-3 whitespace-pre-line">{item.note}</p>}
      </button>
      <button type="button" onClick={() => onToggleDone(item)}
        className={`flex items-center gap-2 min-h-[44px] px-5 border-t hairline font-mono text-[11px] tracking-[0.14em] uppercase transition-colors ${item.completed_at ? "text-[#C9A24A]" : "text-foreground/45 hover:text-[#C9A24A]"} ${FOCUS}`}>
        <Check className="w-4 h-4" strokeWidth={1.5} /> {item.completed_at ? "Ukończone" : "Oznacz jako ukończone"}
      </button>
    </div>
  );
}