import React, { useId, useRef } from "react";
import { useFrame } from "./useFrame";

const R = 42;
const ARC = `M50 ${50 - R} A${R} ${R} 0 1 1 49.99 ${50 - R}`;
const CRACK = "50,-4 51.5,8 49,16 51,24 48.5,33 50.5,41 48,50 51,58 49,67 51.5,76 49,86 50.5,95 50,104";
const thin = { vectorEffect: "non-scaling-stroke", fill: "none" };

// Widok E — znak marki: złota linia rysuje okrąg, przy 00:00 pęknięcie światła.
export default function PortalView({ clock, slow, ending, mini }) {
  const id = useId().replace(/:/g, "");
  const line = useRef(null);
  const halo = useRef(null);
  const dot = useRef(null);

  useFrame(() => {
    const { p } = clock.get();
    if (!line.current) return;
    const off = String(1 - p);
    line.current.style.strokeDashoffset = off;
    halo.current.style.strokeDashoffset = off;
    const a = p * Math.PI * 2;
    dot.current.setAttribute("cx", 50 + R * Math.sin(a));
    dot.current.setAttribute("cy", 50 - R * Math.cos(a));
    dot.current.style.opacity = p > 0.002 && p < 1 && !slow ? 0.8 : 0;
  }, slow);

  const dash = { strokeDasharray: "1 1", strokeDashoffset: 1 };
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full overflow-visible">
      <defs>
        <filter id={`b${id}`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" /></filter>
      </defs>
      <path d={ARC} stroke="#F5EFE1" strokeOpacity="0.1" strokeWidth="1.25" style={thin} />
      {!mini && <path ref={halo} d={ARC} pathLength="1" stroke="#C9A24A" strokeOpacity="0.28" strokeWidth="2.4" fill="none" filter={`url(#b${id})`} style={dash} />}
      {mini && <path ref={halo} d={ARC} pathLength="1" fill="none" style={dash} />}
      <path ref={line} d={ARC} pathLength="1" stroke="#C9A24A" strokeWidth="1.25" style={{ ...thin, ...dash }} />
      <circle ref={dot} r="1.6" fill="#E2C170" filter={mini ? undefined : `url(#b${id})`} style={{ opacity: 0 }} />
      {ending && (
        <g className="portal-crack">
          <polyline points={CRACK} stroke="#E2C170" strokeWidth="3" fill="none" filter={`url(#b${id})`} opacity="0.6" />
          <polyline points={CRACK} stroke="#F5EFE1" strokeWidth="1.25" style={thin} />
        </g>
      )}
    </svg>
  );
}