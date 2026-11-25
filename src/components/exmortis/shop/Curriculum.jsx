import React, { useEffect, useState } from "react";
import { PlayCircle, Headphones, BookOpen } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Program kursu na stronie produktu (lekcje widoczne dla klientów).
const plural = (n, one, few, many) => (n === 1 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many);

export default function Curriculum({ productId, type }) {
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
      {type === "zestaw" ? (() => {
        const audio = lessons.filter((l) => l.kind === "audio").length;
        const video = lessons.length - audio;
        const parts = [
          audio ? `${audio} ${plural(audio, "NAGRANIE AUDIO", "NAGRANIA AUDIO", "NAGRAŃ AUDIO")}` : "",
          video ? `${video} ${plural(video, "NAGRANIE WIDEO", "NAGRANIA WIDEO", "NAGRAŃ WIDEO")}` : "",
        ].filter(Boolean).join(" + ");
        return (
          <p id="curr-h" className="technical text-[10px] gold-text mb-4">
            W ZESTAWIE · E-BOOK PDF + {parts}{total ? ` · OK. ${total >= 90 ? `${Math.round(total / 6) / 10} H` : `${total} MIN`} NAGRAŃ` : ""}
          </p>
        );
      })() : (
        <p id="curr-h" className="technical text-[10px] gold-text mb-4">
          PROGRAM · {lessons.length} {plural(lessons.length, "LEKCJA", "LEKCJE", "LEKCJI")}{total ? ` · OK. ${total >= 90 ? `${Math.round(total / 6) / 10} H` : `${total} MIN`}` : ""}
        </p>
      )}
      <ol className="border hairline divide-y divide-[#3D3D3F]/60">
        {type === "zestaw" && (
          <li>
            <div className="px-4 py-3 flex items-start gap-3 text-sm">
              <BookOpen className="h-4 w-4 mt-0.5 shrink-0 text-foreground/55" strokeWidth={1.25} aria-hidden="true" />
              <span className="flex-1 text-foreground/80">E-book PDF z Twoim znakiem wodnym — czytasz na koncie albo pobierasz</span>
            </div>
          </li>
        )}
        {lessons.map((l, i) => {
          const head = l.module && l.module !== last;
          last = l.module;
          return (
            <li key={i}>
              {head && <p className="technical text-[9px] text-foreground/55 px-4 pt-4 pb-1">{l.module}</p>}
              <div className="px-4 py-3 flex items-start gap-3 text-sm">
                {l.kind === "audio"
                  ? <Headphones className="h-4 w-4 mt-0.5 shrink-0 text-foreground/55" strokeWidth={1.25} aria-hidden="true" />
                  : <PlayCircle className="h-4 w-4 mt-0.5 shrink-0 text-foreground/55" strokeWidth={1.25} aria-hidden="true" />}
                <span className="flex-1 text-foreground/80">{l.title}</span>
                {l.duration_min && <span className="text-xs text-foreground/55 shrink-0">{l.duration_min} min</span>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}