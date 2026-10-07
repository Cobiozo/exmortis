import React, { useRef } from "react";
import { useFrame } from "./useFrame";

// Widok C — złoty pasek napełnia się od lewej.
export default function BarView({ clock, slow, ending, mini }) {
  const fill = useRef(null);
  const head = useRef(null);

  useFrame(() => {
    const { p } = clock.get();
    if (!fill.current) return;
    fill.current.style.transform = `scaleX(${p})`;
    head.current.style.left = `${p * 100}%`;
    head.current.style.opacity = p > 0 && p < 1 && !slow ? 1 : 0;
  }, slow);

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className={`relative ${mini ? "w-[80%] h-[2px]" : "w-[82vw] sm:w-full h-[3px]"} bg-[#F5EFE1]/[0.12]`}>
        <div ref={fill} className={`absolute inset-0 bg-[#C9A24A] origin-left ${ending ? "bar-end" : ""}`} style={{ transform: "scaleX(0)" }} />
        <div
          ref={head}
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-[#E2C170] blur-[3px]"
          style={{ left: 0, opacity: 0 }}
        />
      </div>
    </div>
  );
}