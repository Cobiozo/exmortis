import React from "react";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import BackdropThumb from "@/components/exmortis/cisza/backdrop/BackdropThumb";

const TYPE = { kolor: "Kolor", gradient: "Gradient", zdjecie: "Zdjęcie", wideo: "Wideo" };

export default function BackgroundRow({ bg, drag, onToggle, onDefault, onEdit, onDelete }) {
  const canActivate = (Number(bg.przyciemnienie) || 0) >= (Number(bg.min_przyciemnienie) || 0);
  return (
    <div className="flex items-center gap-4 border hairline px-3 py-2 bg-[#0A0A0B]">
      <span {...(drag || {})} className={drag ? "cursor-grab text-foreground/30" : "w-4"}>{drag && <GripVertical className="h-4 w-4" />}</span>
      <span className="relative h-10 w-10 rounded-full overflow-hidden border hairline shrink-0"><BackdropThumb bg={bg} /></span>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{bg.nazwa}{bg.systemowe && <span className="text-foreground/40"> · systemowe</span>}</p>
        <p className="technical text-[9px] text-foreground/40">{TYPE[bg.typ]}{bg.dzwiek_nazwa ? ` · ♪ ${bg.dzwiek_nazwa}` : ""}</p>
      </div>
      <label className="text-xs flex gap-1.5 items-center text-foreground/60">
        <input type="checkbox" checked={!!bg.aktywne} disabled={bg.systemowe || (!bg.aktywne && !canActivate)} onChange={onToggle} /> Aktywne
      </label>
      <label className="text-xs flex gap-1.5 items-center text-foreground/60">
        <input type="radio" checked={!!bg.domyslne} onChange={onDefault} /> Domyślne
      </label>
      <button onClick={onEdit} aria-label="Edytuj"><Pencil className="h-4 w-4 text-foreground/50 hover:text-[#C9A24A]" /></button>
      {!bg.systemowe && <button onClick={onDelete} aria-label="Usuń"><Trash2 className="h-4 w-4 text-foreground/50 hover:text-accent" /></button>}
    </div>
  );
}