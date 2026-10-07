import React from "react";
import { Buttons, Rich, SectionHead } from "../parts";

export const RATIO = { "1:1": "aspect-square", "4:5": "aspect-[4/5]", "3:2": "aspect-[3/2]", "16:9": "aspect-video" };

export function Img({ img, ratio, className = "" }) {
  if (!img?.url) return <div className={`${RATIO[ratio] || "aspect-video"} bg-[#0F0F10] border hairline ${className}`} />;
  return (
    <img src={img.url} alt={img.alt || ""} loading="lazy" className={`w-full object-cover ${RATIO[ratio] || "aspect-video"} ${className}`}
      style={{ objectPosition: `${img.fx ?? 50}% ${img.fy ?? 50}%` }} />
  );
}

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
      <Img img={d.zdjecie} ratio={d.proporcja} />
      {d.podpis && <figcaption className="technical text-[10px] text-foreground/40 mt-3 px-5 md:px-0">{d.podpis}</figcaption>}
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
    <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
      <figure className={`${imgOrder} ${right ? "md:order-2" : "md:order-1"}`}>
        <Img img={d.zdjecie} ratio={d.proporcja} />
        {d.podpis && <figcaption className="technical text-[10px] text-foreground/40 mt-3">{d.podpis}</figcaption>}
      </figure>
      <div className={`${d.mobile === "dol" ? "order-1" : "order-2"} ${right ? "md:order-1" : "md:order-2"}`}>
        <SectionHead label={label} title={d.tytul} center />
        <Rich html={d.tresc} className="text-foreground/70 text-lg leading-relaxed" />
        <Buttons list={d.przyciski} className="mt-8" />
      </div>
    </div>
  );
}