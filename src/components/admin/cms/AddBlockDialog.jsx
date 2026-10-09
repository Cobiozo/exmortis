import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TYPES, TYPE_ORDER } from "@/components/cms/blockTypes";
import SavedSections from "./SavedSections";
import { PRESETS } from "./presets";
import PresetThumb from "./PresetThumb";

// Okno wyboru typu bloku.
export default function AddBlockDialog({ open, onOpenChange, onPick }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0A0A0B] border hairline max-w-3xl max-h-[85vh] overflow-y-auto rounded-none">
        <DialogHeader><DialogTitle className="relic-heading text-2xl">Dodaj blok</DialogTitle></DialogHeader>
        <p className="technical text-[10px] gold-text">GOTOWE SEKCJE</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
          {PRESETS.map((p) => (
            <button key={p.key} onClick={() => onPick(p.blok())} className="text-left border hairline p-3 hover:border-[#C9A24A] transition-colors">
              <PresetThumb szkic={p.szkic} />
              <p className="text-sm mt-2.5 leading-tight">{p.nazwa}</p>
            </button>
          ))}
        </div>
        <SavedSections open={open} onPick={onPick} />
        <p className="technical text-[10px] gold-text">NOWY BLOK</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TYPE_ORDER.map((k) => {
            const t = TYPES[k];
            return (
              <button key={k} onClick={() => onPick(k)} className="text-left border hairline p-5 hover:border-[#C9A24A] transition-colors">
                <div className="h-16 mb-4 bg-[#070708] border hairline flex items-center justify-center"><t.icon className="h-7 w-7 gold-text" /></div>
                <p className="relic-heading text-base mb-1">{t.label}</p>
                <p className="text-xs text-foreground/50 leading-relaxed">{t.opis}</p>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}