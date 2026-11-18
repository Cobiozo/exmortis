import React from "react";
import { cn } from "@/lib/utils";

// Szeroka karta wyróżnionego materiału: okładka albo odtwarzacz po lewej, dane i odtwarzacz po prawej.
// layout "split" — okładka (podcast), "video" — odtwarzacz 16:9 (muzyka).
export default function GlosFeatured({ media, eyebrow, title, meta, desc, footer, layout = "split" }) {
  return (
    <article className="overflow-hidden rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface">
      <div className={cn("grid", layout === "video" ? "md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]" : "md:grid-cols-[minmax(0,19rem)_1fr]")}>
        <div className={cn("min-w-0 bg-exm-surface-2", layout === "video" && "p-3 md:p-4")}>{media}</div>
        <div className="flex min-w-0 flex-col gap-2.5 p-5 md:p-7">
          {eyebrow && <p className="exm-eyebrow">{eyebrow}</p>}
          {title && <h3 className="font-exm-serif text-[clamp(1.35rem,2.6vw,1.85rem)] leading-[1.15] text-exm-ivory">{title}</h3>}
          {meta && <p className="text-[13px] leading-relaxed text-exm-muted">{meta}</p>}
          {desc && <p className="max-w-[62ch] text-[15px] leading-relaxed text-exm-muted">{desc}</p>}
          {footer && <div className="mt-2 min-w-0">{footer}</div>}
        </div>
      </div>
    </article>
  );
}