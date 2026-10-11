import React from "react";
import { bk } from "./api";

// Święta wyliczane automatycznie na 2 lata do przodu; każde można odblokować.
export default function HolidaysPanel({ holidays, onSaved }) {
  const toggle = async (h) => { await bk("toggle_holiday", { d: h.d, blocked: !h.blocked }); onSaved(); };
  return (
    <div className="max-w-2xl space-y-2">
      {holidays.map((h) => (
        <div key={h.d} className="flex justify-between items-center border hairline p-3 text-sm">
          <span><span className="font-mono mr-3">{new Date(`${h.d}T12:00`).toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" })}</span>{h.name}</span>
          <button onClick={() => toggle(h)} className={`technical text-[10px] px-3 py-1 border ${h.blocked ? "border-[#BC1E22] blood-text" : "hairline text-foreground/60"}`}>
            {h.blocked ? "ZABLOKOWANE" : "ODBLOKOWANE"}
          </button>
        </div>
      ))}
    </div>
  );
}