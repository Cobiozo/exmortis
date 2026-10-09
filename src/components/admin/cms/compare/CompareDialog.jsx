import React, { useEffect, useMemo, useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CompareFrame from "./CompareFrame";
import { blockDiff } from "./blockDiff";

const COLOR = { dodany: "text-emerald-400", usuniety: "blood-text", zmiana: "text-foreground/80" };

// Porównanie przed / po: wersja na stronie (lub z historii) obok szkicu, w 390 i 1440 px.
export default function CompareDialog({ open, onOpenChange, page, blocks }) {
  const [width, setWidth] = useState(1440);
  const [src, setSrc] = useState("strona");
  const [published, setPublished] = useState(null);
  const [versions, setVersions] = useState([]);
  useEffect(() => {
    if (!open) return;
    base44.entities.PublishedPage.filter({ slug: page.slug }, { limit: 1 }).then((r) => setPublished(r.items[0]?.bloki || []));
    base44.entities.PageVersion.filter({ slug: page.slug }, { sort: "-wersja", limit: 50 }).then((r) => setVersions(r.items));
  }, [open, page.slug]);
  const before = src === "strona" ? published : versions.find((v) => v.id === src)?.bloki || [];
  const diff = useMemo(() => (before ? blockDiff(before, blocks) : []), [before, blocks]);
  const btn = (on) => `min-h-[40px] px-3 inline-flex items-center gap-2 technical text-[10px] border ${on ? "border-[#C9A24A] gold-text" : "hairline text-foreground/50"}`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0A0A0B] border hairline max-w-[96vw] w-[96vw] max-h-[95vh] overflow-y-auto rounded-none">
        <DialogHeader><DialogTitle className="relic-heading text-2xl">Porównanie przed i po</DialogTitle></DialogHeader>
        <div className="flex flex-wrap gap-2 items-center">
          <button className={btn(width === 390)} onClick={() => setWidth(390)}><Smartphone className="h-4 w-4" /> Telefon 390</button>
          <button className={btn(width === 1440)} onClick={() => setWidth(1440)}><Monitor className="h-4 w-4" /> Komputer 1440</button>
          <select value={src} onChange={(e) => setSrc(e.target.value)} className="dt-input bg-[#0F0F10] border hairline px-3 min-h-[40px] text-sm ml-auto">
            <option value="strona">Przed: wersja na stronie</option>
            {versions.map((v) => <option key={v.id} value={v.id}>Przed: wersja {v.wersja}</option>)}
          </select>
        </div>
        {!before ? <div className="h-64 border hairline animate-pulse bg-[#0F0F10]" /> : (
          <div className="grid lg:grid-cols-[1fr_1fr_280px] gap-4">
            <CompareFrame key={`p-${width}`} title="PRZED" blocks={before} width={width} />
            <CompareFrame key={`s-${width}`} title="PO (SZKIC)" blocks={blocks} width={width} />
            <div>
              <p className="technical text-[10px] gold-text mb-2">RÓŻNICE ({diff.length})</p>
              {!diff.length ? <p className="text-sm text-foreground/50">Brak różnic — szkic jest taki sam jak wersja „przed”.</p> : (
                <ul className="space-y-2 text-sm border hairline p-3 max-h-[65vh] overflow-y-auto">
                  {diff.map((d, i) => <li key={i} className={COLOR[d.typ]}>{d.tekst}</li>)}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}