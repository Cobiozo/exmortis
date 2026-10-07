import React, { useRef } from "react";
import { useFrame, mmss, minutesText } from "./useFrame";

// Duże cyfry MM:SS i cienki złoty pasek. Aktualizacja bezpośrednio w DOM — bez przerysowań Reacta.
export default function TimerView({ clock, view = "cyfry_pasek", minutesOnly, ending, reduced, small, label }) {
  const mm = useRef(null), ss = useRef(null), txt = useRef(null), fill = useRef(null), dot = useRef(null);
  useFrame(() => {
    const { p, rem } = clock.get();
    if (txt.current) txt.current.textContent = minutesText(rem);
    if (mm.current) { const [m, s] = mmss(rem); mm.current.textContent = m; ss.current.textContent = s; }
    const w = `${Math.min(1, Math.max(0, p)) * 100}%`;
    if (fill.current) fill.current.style.width = w;
    if (dot.current) dot.current.style.left = w;
  }, reduced ? 1000 : 0);

  const digits = view !== "pasek";
  const bar = view !== "cyfry";
  return (
    <div role="timer" aria-label={label} className="flex flex-col items-center select-none max-w-full"
      style={small ? { "--cisza-digits": "28px" } : undefined}>
      {digits && (
        <div className="shop-heading digits text-[#F5EFE1] leading-none whitespace-nowrap" style={{ fontSize: "var(--cisza-digits)" }}>
          {minutesOnly ? <span ref={txt} /> : (
            <><span ref={mm}>00</span><span className={`text-[#C9A24A] ${reduced ? "" : "breathe"}`}>:</span><span ref={ss}>00</span></>
          )}
        </div>
      )}
      {bar && (
        <div className={`relative h-[3px] ${digits ? "mt-6" : ""} ${ending ? "bar-end" : ""}`}
          style={{ width: small ? "70%" : "clamp(240px, calc(var(--cisza-digits) * 2.7), min(520px, 86vw))", minWidth: small ? 80 : undefined }}>
          <div className="absolute inset-0 bg-[#F5EFE1]/12" />
          <div ref={fill} className="absolute inset-y-0 left-0 bg-[#C9A24A]" />
          <span ref={dot} className="absolute top-1/2 h-1.5 w-1.5 -ml-[3px] -mt-[3px] rounded-full bg-[#E2C170] shadow-[0_0_8px_2px_rgba(201,162,74,0.5)]" />
        </div>
      )}
    </div>
  );
}