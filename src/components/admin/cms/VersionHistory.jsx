import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { smallBtn } from "./ui";

const when = (d) => new Date(d).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", dateStyle: "medium", timeStyle: "short" });

// Opublikowane wersje strony: wczytanie do szkicu albo ponowna publikacja (przywrócenie).
export default function VersionHistory({ open, onOpenChange, page, onLoad, onRepublish }) {
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(null);
  useEffect(() => {
    if (!open) return;
    setItems(null);
    base44.entities.PageVersion.filter({ slug: page.slug }, { sort: "-wersja", limit: 50 }).then((r) => setItems(r.items));
  }, [open, page.slug, page.wersja]);
  const republish = async (v) => {
    if (!window.confirm(`Opublikować ponownie wersję ${v.wersja}? Strona publiczna od razu się zmieni.`)) return;
    setBusy(v.id); await onRepublish(v); setBusy(null); onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0A0A0B] border hairline max-w-2xl max-h-[85vh] overflow-y-auto rounded-none">
        <DialogHeader><DialogTitle className="relic-heading text-2xl">Historia wersji</DialogTitle></DialogHeader>
        {!items && <div className="h-24 border hairline animate-pulse bg-[#0F0F10]" />}
        {items && !items.length && <p className="text-sm text-foreground/50">Brak zapisanych wersji. Pojawią się po kolejnej publikacji.</p>}
        <div className="divide-y divide-[#3D3D3F]/60 border hairline">
          {items?.map((v) => (
            <div key={v.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-[200px]">
                <p className="relic-heading text-base">Wersja {v.wersja}{v.wersja === page.wersja && <span className="technical text-[9px] gold-text ml-2">NA STRONIE</span>}</p>
                <p className="technical text-[9px] text-foreground/40">{when(v.created_date)}{v.kto ? ` · ${v.kto}` : ""} · {v.opis}</p>
              </div>
              <button className={smallBtn} onClick={() => { onLoad(v); onOpenChange(false); }}>Wczytaj do szkicu</button>
              {v.wersja !== page.wersja && (
                <button className={smallBtn} disabled={!!busy} onClick={() => republish(v)}>
                  {busy === v.id && <Loader2 className="h-4 w-4 animate-spin" />} Przywróć na stronę
                </button>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}