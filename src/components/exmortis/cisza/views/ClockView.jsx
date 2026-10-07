import React, { useRef } from "react";
import { useFrame } from "./useFrame";

const R = 46;
const pt = (a) => [50 + R * Math.sin(a), 50 - R * Math.cos(a)];
const thin = { vectorEffect: "non-scaling-stroke", fill: "none" };

// Pozostały czas = wycinek od wskazówki do godziny 12, kurczy się zgodnie z ruchem wskazówek.
function wedge(p) {
  const f = 1 - p;
  if (f <= 0.0005) return "";
  if (f >= 0.9995) return `M50 50 L50 ${50 - R} A${R} ${R} 0 1 1 49.99 ${50 - R} Z`;
  const [x, y] = pt(p * Math.PI * 2);
  return `M50 50 L${x} ${y} A${R} ${R} 0 ${f > 0.5 ? 1 : 0} 1 50 ${50 - R} Z`;
}

// Widok B — minimalistyczna tarcza.
export default function ClockView({ clock, slow }) {
  const area = useRef(null);
  const hand = useRef(null);

  useFrame(() => {
    const { p } = clock.get();
    if (!area.current) return;
    area.current.setAttribute("d", wedge(p));
    const [x, y] = pt(p * Math.PI * 2);
    hand.current.setAttribute("x2", x);
    hand.current.setAttribute("y2", y);
  }, slow);

  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full overflow-visible">
      <circle cx="50" cy="50" r={R} stroke="#C9A24A" strokeWidth="1.25" style={thin} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const l = i % 3 === 0 ? 5 : 3;
        return (
          <line key={i} x1={50 + (R - 1.5) * Math.sin(a)} y1={50 - (R - 1.5) * Math.cos(a)}
            x2={50 + (R - 1.5 - l) * Math.sin(a)} y2={50 - (R - 1.5 - l) * Math.cos(a)}
            stroke="#C9A24A" strokeOpacity="0.7" strokeWidth="1" style={thin} />
        );
      })}
      <path ref={area} fill="#C9A24A" fillOpacity="0.22" stroke="#C9A24A" strokeOpacity="0.85" strokeWidth="1.25" vectorEffect="non-scaling-stroke" />
      <line ref={hand} x1="50" y1="50" x2="50" y2={50 - R} stroke="#F5EFE1" strokeWidth="1.25" style={thin} />
      <circle cx="50" cy="50" r="1.4" fill="#F5EFE1" />
    </svg>
  );
}