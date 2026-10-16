import React from "react";
import { CheckCircle2, Circle, PlayCircle, Clock } from "lucide-react";

export default function LessonList({ lessons, current, onPick }) {
  let lastModule = null;
  return (
    <aside className="border hairline divide-y divide-[#3D3D3F]/60 self-start">
      {lessons.map((l) => {
        const head = l.module && l.module !== lastModule;
        lastModule = l.module;
        const Icon = l.id === current ? PlayCircle : l.completed ? CheckCircle2 : Circle;
        return (
          <div key={l.id}>
            {head && <p className="technical text-[9px] gold-text px-4 pt-4 pb-2">{l.module}</p>}
            <button onClick={() => onPick(l.id)} className={`w-full text-left px-4 py-3 flex gap-3 items-start hover:bg-[#0F0F10] ${l.id === current ? "bg-[#0F0F10]" : ""}`}>
              {l.has_video
                ? <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${l.completed || l.id === current ? "gold-text" : "text-foreground/55"}`} strokeWidth={1.25} />
                : <Clock className="h-4 w-4 mt-0.5 shrink-0 text-foreground/40" strokeWidth={1.25} />}
              <span className={`text-sm flex-1 ${l.has_video ? "text-foreground/80" : "text-foreground/55"}`}>{l.title}</span>
              {!l.has_video
                ? <span className="technical text-[9px] text-foreground/45 shrink-0">WKRÓTCE</span>
                : l.duration_min && <span className="text-xs text-foreground/55">{l.duration_min} min</span>}
            </button>
          </div>
        );
      })}
    </aside>
  );
}