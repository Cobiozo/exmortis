import React, { useMemo, useState } from "react";
import Backdrop from "@/components/exmortis/cisza/backdrop/Backdrop";
import { VIEWS, getView } from "@/components/exmortis/cisza/views";
import { fixedClock } from "@/components/exmortis/cisza/views/useFrame";

// Podgląd na żywo: komputer i telefon obok siebie, z wybranym widokiem odliczania.
export default function BgLivePreview({ bg }) {
  const [view, setView] = useState("portal");
  const clock = useMemo(() => fixedClock(0.4, 360000), []);
  const { C } = getView(view);

  const frame = (phone) => (
    <div className={`relative overflow-hidden border hairline bg-[#0A0A0A] ${phone ? "w-[150px] shrink-0 aspect-[9/16]" : "flex-1 aspect-[16/10]"}`}>
      <Backdrop contained portrait={phone} bg={bg} fadeMs={0} />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className={`relative ${phone ? "w-[70%]" : "h-[70%]"} aspect-square`}>
          <C clock={clock} slow={1000} mini={phone && view === "cyfry"} />
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {VIEWS.map((v) => (
          <button key={v.id} type="button" onClick={() => setView(v.id)}
            className={`technical text-[9px] px-3 py-1.5 border ${view === v.id ? "border-[#C9A24A] gold-text" : "hairline text-foreground/50"}`}>
            {v.label}
          </button>
        ))}
      </div>
      <div className="flex gap-4 items-start">{frame(false)}{frame(true)}</div>
    </div>
  );
}