import React from "react";
import { ArrowUp, ArrowDown, Copy, EyeOff, Trash2 } from "lucide-react";

const ACTIONS = [["wyzej", ArrowUp, "Wyżej (Alt+↑)"], ["nizej", ArrowDown, "Niżej (Alt+↓)"], ["duplikuj", Copy, "Duplikuj (Ctrl+D)"], ["ukryj", EyeOff, "Ukryj"], ["usun", Trash2, "Usuń (Delete)"]];

// Pasek akcji nad zaznaczonym blokiem w podglądzie.
export default function PreviewTools({ name, onAction }) {
  return (
    <div data-tools className="absolute top-2 right-2 z-40 flex items-center gap-1 bg-[#0A0A0B] border border-[#C9A24A] p-1 shadow-lg">
      <span className="technical text-[9px] gold-text px-2 max-w-[160px] truncate">{name}</span>
      {ACTIONS.map(([a, Icon, l]) => (
        <button key={a} type="button" title={l} aria-label={l} onClick={(e) => { e.preventDefault(); onAction(a); }}
          className={`h-8 w-8 inline-flex items-center justify-center hover:bg-[#1A1A1B] ${a === "usun" ? "text-[#BC1E22]" : "text-foreground/80"}`}>
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}