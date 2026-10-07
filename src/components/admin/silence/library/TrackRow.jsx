import React from "react";
import { ArrowUp, ArrowDown, Pencil, Trash2, Star } from "lucide-react";
import { CATS } from "@/components/exmortis/cisza/library";
import { fmt, trackWarnings } from "./libUtils";

const START = { poczatek: "od początku", losowe: "losowo", minuta: "od minuty" };

export default function TrackRow({ t, onUp, onDown, onEdit, onDelete }) {
  const warns = trackWarnings(t);
  return (
    <div className="border hairline p-4 flex flex-wrap items-center gap-4">
      <span className="h-10 w-10 shrink-0 bg-cover bg-center" style={{ backgroundColor: t.kolor || "#1A1712", backgroundImage: t.miniatura ? `url(${t.miniatura})` : undefined }} />
      <div className="min-w-[180px] flex-1">
        <p className="text-sm text-foreground flex items-center gap-2">
          {t.nazwa} {t.domyslny && <Star className="h-3.5 w-3.5 text-[#C9A24A]" />}
          {!t.aktywny && <span className="technical text-[9px] text-foreground/40">nieaktywny</span>}
        </p>
        <p className="text-xs text-foreground/45">
          {CATS.find((c) => c.id === t.kategoria)?.label} · {fmt(t.dlugosc_s)} · {START[t.start_tryb] || "od początku"}{t.start_tryb === "minuta" ? ` ${t.start_minuta}` : ""} · {t.zapetlaj !== false ? `pętla ${t.przenikanie_s || 4} s` : "bez pętli"}
          {t.korekta_db ? ` · ${t.korekta_db > 0 ? "+" : ""}${t.korekta_db} dB` : ""}
        </p>
        {warns.map((w) => <p key={w} className="text-xs text-[#E8C547] mt-1">{w}</p>)}
      </div>
      {t.plik && <audio controls preload="none" src={t.plik} className="h-8 max-w-[260px]" />}
      <div className="flex gap-1 text-foreground/50">
        <button onClick={onUp} aria-label="W górę" className="p-1.5 hover:text-foreground"><ArrowUp className="h-4 w-4" /></button>
        <button onClick={onDown} aria-label="W dół" className="p-1.5 hover:text-foreground"><ArrowDown className="h-4 w-4" /></button>
        <button onClick={onEdit} aria-label="Edytuj" className="p-1.5 hover:text-[#C9A24A]"><Pencil className="h-4 w-4" /></button>
        <button onClick={onDelete} aria-label="Usuń" className="p-1.5 hover:text-[#BC1E22]"><Trash2 className="h-4 w-4" /></button>
      </div>
    </div>
  );
}