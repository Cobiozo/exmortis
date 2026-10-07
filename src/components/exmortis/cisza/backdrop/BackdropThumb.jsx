import React from "react";
import { Image } from "@/components/ui/image";
import { bgCss, imageOf } from "./backdrops";

// Statyczna miniatura tła (bez odtwarzania wideo).
export default function BackdropThumb({ bg }) {
  const img = imageOf(bg, true);
  return (
    <span className="absolute inset-0">
      {bg.systemowe ? <span className="absolute inset-0 cisza-vignette" /> : <span className="absolute inset-0" style={{ background: bgCss(bg) }} />}
      {img && <Image src={img} alt="" className="absolute inset-0 w-full h-full" focalPointX={(bg.fokus_x ?? 50) / 100} focalPointY={(bg.fokus_y ?? 50) / 100} />}
      <span className="absolute inset-0 bg-black" style={{ opacity: ((Number(bg.przyciemnienie) || 0) / 100) * 0.7 }} />
    </span>
  );
}