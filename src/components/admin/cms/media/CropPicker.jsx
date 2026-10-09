import React from "react";
import { KADRY, RATIO } from "@/components/cms/ratios";

// Kadr zdjęcia w bloku: proporcja + punkt skupienia. Oryginał w bibliotece się nie zmienia.
export default function CropPicker({ v, onChange, noKadr }) {
  const focus = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    onChange({ ...v, fx: Math.round(((e.clientX - r.left) / r.width) * 100), fy: Math.round(((e.clientY - r.top) / r.height) * 100) });
  };
  const chip = (on) => `px-2.5 py-1.5 technical text-[9px] border ${on ? "border-[#C9A24A] gold-text" : "hairline text-foreground/50 hover:text-foreground"}`;
  return (
    <div className="space-y-3">
      <div className={`flex flex-wrap gap-1.5 ${noKadr ? "hidden" : ""}`} role="group" aria-label="Kadr">
        <button type="button" onClick={() => onChange({ ...v, kadr: null })} className={chip(!v.kadr)}>Jak w bloku</button>
        {KADRY.map((k) => <button key={k} type="button" onClick={() => onChange({ ...v, kadr: k })} className={chip(v.kadr === k)}>{k}</button>)}
      </div>
      <div className="grid grid-cols-2 gap-3 items-start">
        <div className="relative cursor-crosshair" onClick={focus} title="Kliknij, aby ustawić punkt skupienia">
          <img src={v.url} alt="" draggable={false} className="w-full max-h-48 object-contain bg-black" />
          <span className="absolute h-5 w-5 -ml-2.5 -mt-2.5 rounded-full border-2 border-[#C9A24A] bg-[#C9A24A]/30 pointer-events-none" style={{ left: `${v.fx ?? 50}%`, top: `${v.fy ?? 50}%` }} />
        </div>
        <div>
          <div className={`${RATIO[v.kadr] || "aspect-[4/3]"} w-full overflow-hidden border hairline bg-black`}>
            <img src={v.url} alt="" draggable={false} className="w-full h-full object-cover" style={{ objectPosition: `${v.fx ?? 50}% ${v.fy ?? 50}%` }} />
          </div>
          <p className="technical text-[9px] text-foreground/40 mt-1.5">PODGLĄD KADRU {v.kadr || "(PROPORCJA BLOKU)"}</p>
        </div>
      </div>
      <p className="text-xs text-foreground/40">Kliknij na lewym zdjęciu miejsce, które ma zostać w kadrze. Kadr jest zapisany tylko w tym bloku.</p>
    </div>
  );
}