import React from "react";
import { CROPS } from "./coverKit";

// Podgląd z ustawianiem punktu skupienia (klik / dotknięcie / strzałki) + siatka kadrów.
export default function FocusCrops({ src, fx, fy, onFocus, cancelled }) {
  const pos = `${fx * 100}% ${fy * 100}%`;
  const pick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    onFocus(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)));
  };
  const key = (e) => {
    const d = { ArrowLeft: [-0.05, 0], ArrowRight: [0.05, 0], ArrowUp: [0, -0.05], ArrowDown: [0, 0.05] }[e.key];
    if (!d) return;
    e.preventDefault();
    onFocus(Math.min(1, Math.max(0, fx + d[0])), Math.min(1, Math.max(0, fy + d[1])));
  };
  return (
    <div className="space-y-4">
      <div role="slider" tabIndex={0} aria-label="Punkt skupienia — kliknij miejsce, które ma zostać w kadrze (strzałki przesuwają)"
        aria-valuetext={`${Math.round(fx * 100)}% od lewej, ${Math.round(fy * 100)}% od góry`}
        onClick={pick} onKeyDown={key} className="relative cursor-crosshair select-none focus-visible:ring-2 focus-visible:ring-[#C9A24A]">
        <img src={src} alt="" className={`w-full h-auto block ${cancelled ? "grayscale" : ""}`} draggable={false} />
        <span className="absolute h-8 w-8 -ml-4 -mt-4 rounded-full border-2 border-[#C9A24A] bg-[#C9A24A]/25 shadow-[0_0_0_2px_rgba(0,0,0,0.6)] pointer-events-none"
          style={{ left: `${fx * 100}%`, top: `${fy * 100}%` }} />
      </div>
      <p className="text-xs text-foreground/50">Dotknij lub kliknij miejsce, które ma zostać w każdym kadrze.</p>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {CROPS.filter((c) => c.key !== "mail").map((c) => (
          <figure key={c.key} className="min-w-0">
            <div className={`w-full bg-cover bg-no-repeat border hairline ${cancelled ? "grayscale" : ""}`}
              style={{ aspectRatio: `${c.w} / ${c.h}`, backgroundImage: `url("${src}")`, backgroundPosition: pos }} />
            <figcaption className="text-[11px] text-foreground/50 mt-1">{c.label}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}