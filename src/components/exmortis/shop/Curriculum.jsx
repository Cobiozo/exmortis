import React, { useEffect, useState } from "react";
import { PlayCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Program kursu na stronie produktu (lekcje widoczne dla klientów).
export default function Curriculum({ productId }) {
  const [lessons, setLessons] = useState(null);
  useEffect(() => {
    base44.functions.invoke("shopProducts", { action: "curriculum", product_id: productId })
      .then((r) => setLessons(r.data?.lessons || [])).catch(() => setLessons([]));
  }, [productId]);
  if (!lessons || !lessons.length) return null;
  const total = lessons.reduce((s, l) => s + (Number(l.duration_min) || 0), 0);
  let last = null;
  return (
    <section className="mb-10" aria-labelledby="curr-h">
      <p id="curr-h" className="technical text-[10px] gold-text mb-4">
        PROGRAM · {lessons.length} {lessons.length === 1 ? "LEKCJA" : lessons.length < 5 ? "LEKCJE" : "LEKCJI"}{total ? ` · OK. ${total >= 90 ? `${Math.round(total / 6) / 10} H` : `${total} MIN`}` : ""}
      </p>
      <ol className="border hairline divide-y divide-[#3D3D3F]/60">
        {lessons.map((l, i) => {
          const head = l.module && l.module !== last;
          last = l.module;
          return (
            <li key={i}>
              {head && <p className="technical text-[9px] text-foreground/45 px-4 pt-4 pb-1">{l.module}</p>}
              <div className="px-4 py-3 flex items-start gap-3 text-sm">
                <PlayCircle className="h-4 w-4 mt-0.5 shrink-0 text-foreground/35" strokeWidth={1.25} aria-hidden="true" />
                <span className="flex-1 text-foreground/80">{l.title}</span>
                {l.duration_min && <span className="text-xs text-foreground/40 shrink-0">{l.duration_min} min</span>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
