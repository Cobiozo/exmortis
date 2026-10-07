import React, { useEffect, useState } from "react";
import { Image } from "@/components/ui/image";
import LoopVideo from "./LoopVideo";
import { bgCss, imageOf, isPortrait } from "./backdrops";

// Jedna warstwa tła: kolor/gradient/zdjęcie/wideo + rozmycie, powolny ruch, przyciemnienie.
export default function BackdropLayer({ bg, fadeMs, animate, still, reduced, zoomMs, portrait }) {
  const [zoom, setZoom] = useState(false);
  const move = bg.typ === "zdjecie" && bg.ruch && !reduced && zoomMs > 0;
  useEffect(() => {
    if (!move) { setZoom(false); return; }
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setZoom(true)));
    return () => cancelAnimationFrame(r);
  }, [move, zoomMs]);

  const blur = Number(bg.rozmycie) || 0;
  const pos = { x: (bg.fokus_x ?? 50) / 100, y: (bg.fokus_y ?? 50) / 100 };
  const media = bg.typ === "zdjecie" || bg.typ === "wideo";
  const scale = (blur ? 1.06 : 1) * (zoom ? 1.08 : 1);
  const img = imageOf(bg, portrait ?? isPortrait());

  return (
    <div className="absolute inset-0" style={animate ? { animation: `xfade-in ${fadeMs}ms ease both` } : undefined}>
      {bg.systemowe ? <div className="absolute inset-0 cisza-vignette" /> : <div className="absolute inset-0" style={{ background: bgCss(bg) }} />}
      {media && (
        <div
          className="absolute inset-0"
          style={{ filter: blur ? `blur(${blur}px)` : undefined, transform: `scale(${scale})`, transition: move ? `transform ${zoomMs}ms linear` : undefined }}
        >
          {bg.typ === "zdjecie"
            ? img && <Image src={img} alt="" className="absolute inset-0 w-full h-full" focalPointX={pos.x} focalPointY={pos.y} />
            : <LoopVideo bg={bg} still={still || reduced} pos={pos} />}
        </div>
      )}
      <div className="absolute inset-0 bg-black" style={{ opacity: (Number(bg.przyciemnienie) || 0) / 100 }} />
    </div>
  );
}