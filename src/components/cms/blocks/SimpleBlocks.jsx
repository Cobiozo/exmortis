import React from "react";
import { Buttons, Rich, SectionHead } from "../parts";
import SafeImg from "../SafeImg";

import { ratioClass } from "../ratios";

export function Img({ img, ratio, className = "", sizes = "(min-width: 768px) 50vw, 100vw" }) {
  if (!img?.url) return <div className={`${ratioClass(null, ratio)} bg-[#0F0F10] border hairline ${className}`} />;
  return (
    <SafeImg img={img} sizes={sizes} className={`w-full ${ratioClass(img, ratio)} ${className}`} />
  );
}

// Proporcje kolumn zdjęcie–tekst; kolejność kolumn zależy od strony zdjęcia.
const COLS = {
  "50-50": ["md:grid-cols-2", "md:grid-cols-2"],
  "60-40": ["md:grid-cols-[3fr_2fr]", "md:grid-cols-[2fr_3fr]"],
  "40-60": ["md:grid-cols-[2fr_3fr]", "md:grid-cols-[3fr_2fr]"],
};

export function TextBlock({ d, label, center }) {
  return (
    <>
      <SectionHead label={label} title={d.tytul} center />
      <Rich html={d.tresc} className={`text-foreground/70 text-lg leading-relaxed prose-measure ${center ? "mx-auto" : ""}`} />
    </>
  );
}

export function ImageBlock({ d }) {
  return (
    <figure>
      <Img img={d.zdjecie} ratio={d.proporcja} sizes="(min-width: 1470px) 1320px, (min-width: 768px) calc(100vw - 80px), calc(100vw - 40px)" />
      {d.podpis && <figcaption className="technical text-[10px] text-foreground/55 mt-3 px-5 md:px-0">{d.podpis}</figcaption>}
    </figure>
  );
}

export function ButtonsBlock({ d, center }) {
  return <Buttons list={d.przyciski} className={center ? "justify-center" : ""} />;
}

export function QuoteBlock({ d }) {
  return (
    <blockquote className="border-l border-[#C9A24A] pl-6 md:pl-10 max-w-4xl">
      <p className="shop-heading text-3xl md:text-5xl leading-tight text-[#E8DFC9]">{d.tekst}</p>
      {d.podpis && <footer className="technical text-[10px] gold-text mt-6">{d.podpis}</footer>}
    </blockquote>
  );
}

export function SeparatorBlock({ d }) {
  return d.wariant === "odstep" ? <div className="h-8" /> : <div className="h-px w-24 bg-[#C9A24A] mx-auto" />;
}

export function LinesBlock({ d, label }) {
  const accent = Number(d.akcent) || 0;
  return (
    <>
      {label && <p className="technical text-[11px] gold-text mb-14 text-center">{label}</p>}
      <div className="space-y-6">
        {(d.linie || []).map((line, i) => (
          <p key={i} className={`font-heading text-xl md:text-3xl leading-snug ${i + 1 === accent ? "blood-text" : "text-foreground/85"}`}>{line}</p>
        ))}
      </div>
    </>
  );
}

export function TextImageBlock({ d, label }) {
  const right = d.strona === "prawo";
  const imgOrder = d.mobile === "dol" ? "order-2" : "order-1";
  return (
    <div className={`grid ${(COLS[d.kolumny] || COLS["50-50"])[right ? 1 : 0]} gap-10 md:gap-16 items-center`}>
      <figure className={`${imgOrder} ${right ? "md:order-2" : "md:order-1"}`}>
        <Img img={d.zdjecie} ratio={d.proporcja} />
        {d.podpis && <figcaption className="technical text-[10px] text-foreground/55 mt-3">{d.podpis}</figcaption>}
      </figure>
      <div className={`${d.mobile === "dol" ? "order-1" : "order-2"} ${right ? "md:order-1" : "md:order-2"}`}>
        <SectionHead label={label} title={d.tytul} center />
        <Rich html={d.tresc} className="text-foreground/70 text-lg leading-relaxed" />
        <Buttons list={d.przyciski} className="mt-8" />
      </div>
    </div>
  );
}