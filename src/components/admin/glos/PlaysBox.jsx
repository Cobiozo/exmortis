import React, { useState } from "react";
import PlaysPanel from "@/components/admin/stats/PlaysPanel";

// Odtworzenia odcinków i utworów na /glos — te same dane co w Statystykach, z wyborem okresu.
export default function PlaysBox() {
  const [range, setRange] = useState(30);
  return (
    <div>
      <div className="flex gap-2 mb-6">
        {[7, 30, 90].map((d) => (
          <button key={d} onClick={() => setRange(d)}
            className={`technical text-[10px] px-4 py-2 border ${range === d ? "border-[#C9A24A] gold-text" : "hairline text-foreground/55 hover:text-foreground"}`}>
            {d} DNI
          </button>
        ))}
      </div>
      <PlaysPanel range={range} />
    </div>
  );
}
