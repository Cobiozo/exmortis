import React, { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { TYPES } from "@/components/cms/blockTypes";

// Własne sekcje zapisane z bloków — wstawiane jako kopia.
export default function SavedSections({ open, onPick }) {
  const [items, setItems] = useState(null);
  const load = () => base44.entities.CmsSection.filter({}, { sort: "nazwa", limit: 100 }).then((r) => setItems(r.items));
  useEffect(() => { if (open) load(); }, [open]);
  const remove = async (s) => {
    if (!window.confirm(`Usunąć sekcję „${s.nazwa}”? Strony, na których już jest, nie zmienią się.`)) return;
    await base44.entities.CmsSection.delete(s.id);
    load();
  };
  if (!items) return <div className="h-16 border hairline animate-pulse bg-[#0F0F10] mb-6" />;
  return (
    <div className="mb-6">
      <p className="technical text-[10px] gold-text mb-3">TWOJE SEKCJE</p>
      {!items.length && <p className="text-xs text-foreground/50">Brak. Zapisz blok przez menu „⋯” → „Zapisz jako własną sekcję”.</p>}
      <div className="grid sm:grid-cols-2 gap-2">
        {items.map((s) => {
          const Icon = TYPES[s.blok?.typ]?.icon;
          return (
            <div key={s.id} className="flex items-center gap-2 border hairline hover:border-[#C9A24A]">
              <button onClick={() => onPick(s.blok)} className="flex-1 flex items-center gap-3 text-left p-3">
                {Icon && <Icon className="h-4 w-4 gold-text shrink-0" />}
                <span className="text-sm truncate">{s.nazwa}</span>
              </button>
              <button onClick={() => remove(s)} aria-label="Usuń sekcję" className="p-3 text-foreground/40 hover:text-[#BC1E22]"><Trash2 className="h-4 w-4" /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}