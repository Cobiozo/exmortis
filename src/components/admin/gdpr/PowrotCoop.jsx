import React from "react";

// Status współpracy POWRÓT — bez rozpoczęcia zgłoszenie znika po 6 mies., po zakończeniu po 12 mies.
export default function PowrotCoop({ rows, call, onDone }) {
  if (!rows?.length) return null;
  const r = rows[0];
  const set = async (field, clear) => { const d = await call("powrot", { field, clear }); if (!d.error) onDone(); };
  const day = (v) => (v ? new Date(v).toLocaleDateString("pl-PL") : "—");
  return (
    <div className="border hairline p-4 space-y-3 text-sm">
      <p className="technical text-[10px] gold-text">ZGŁOSZENIE POWRÓT · {day(r.created_date)}</p>
      <p className="text-foreground/70">Współpraca od: {day(r.wspolpraca_od)} · do: {day(r.wspolpraca_do)}</p>
      <p className="text-foreground/50 text-xs">{!r.wspolpraca_od ? "Bez współpracy: usunięcie 6 miesięcy od zgłoszenia." : !r.wspolpraca_do ? "Trwa współpraca: dane zostają." : "Usunięcie 12 miesięcy po zakończeniu."}</p>
      <div className="flex flex-wrap gap-2">
        {!r.wspolpraca_od && <button onClick={() => set("od")} className="btn-ghost !py-2 !px-4 text-[10px]">ROZPOCZĘTO WSPÓŁPRACĘ (DZIŚ)</button>}
        {r.wspolpraca_od && !r.wspolpraca_do && <button onClick={() => set("do")} className="btn-ghost !py-2 !px-4 text-[10px]">ZAKOŃCZONO (DZIŚ)</button>}
        {r.wspolpraca_od && <button onClick={() => set(r.wspolpraca_do ? "do" : "od", true)} className="technical text-[10px] text-foreground/40 hover:gold-text">COFNIJ</button>}
      </div>
    </div>
  );
}