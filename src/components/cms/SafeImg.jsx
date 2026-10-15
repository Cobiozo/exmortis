import React from "react";
import { mediaSrcSet } from "@/lib/imgSrcSet";

const W = [480, 960, 1600, 2000];
const block = (e) => e.preventDefault();

// Obraz z biblioteki: wersje przez proxy, bez menu „Zapisz obraz”, bez przeciągania, pod przezroczystą warstwą.
export default function SafeImg({ img, className = "", imgClass = "", style, eager, sizes = "100vw" }) {
  const url = img?.url || "";
  const proxied = url.startsWith("/functions/media");
  const media = proxied ? null : mediaSrcSet(url);
  const src = proxied ? `${url}&w=960` : media?.src || url;
  const srcSet = proxied ? W.map((w) => `${url}&w=${w} ${w}w`).join(", ") : media?.srcSet;
  return (
    <div className={`relative overflow-hidden select-none [-webkit-touch-callout:none] ${className}`} onContextMenu={block}>
      <img src={src} srcSet={srcSet} sizes={srcSet ? sizes : undefined} alt={img?.alt || ""} draggable={false}
        loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : undefined} decoding="async"
        className={`w-full h-full object-cover pointer-events-none ${imgClass}`}
        style={{ objectPosition: `${img?.fx ?? 50}% ${img?.fy ?? 50}%`, ...style }} />
      <div className="absolute inset-0" aria-hidden="true" onContextMenu={block} onDragStart={block} />
    </div>
  );
}