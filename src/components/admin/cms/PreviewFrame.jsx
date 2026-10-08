import React, { useEffect, useRef, useState } from "react";
import { Monitor, Smartphone, Tablet } from "lucide-react";

const DEVICES = [["390", Smartphone, "Telefon"], ["768", Tablet, "Tablet"], ["1440", Monitor, "Komputer"]];

// Podgląd na żywo w ramce o rzeczywistej szerokości urządzenia (skalowanej do panelu).
export default function PreviewFrame({ blocks, selectedId, onSelect, scrollTo, onAction, onEdit, onKey }) {
  const [w, setW] = useState("1440");
  const [box, setBox] = useState(800);
  const wrap = useRef(null);
  const frame = useRef(null);
  const ready = useRef(false);

  const post = (msg) => frame.current?.contentWindow?.postMessage(msg, window.location.origin);
  useEffect(() => {
    const on = (e) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "cms-ready") { ready.current = true; post({ type: "cms-blocks", blocks, selectedId }); }
      if (e.data?.type === "cms-select") onSelect(e.data.id);
      if (e.data?.type === "cms-action") onAction(e.data.action, e.data.id);
      if (e.data?.type === "cms-edit") onEdit(e.data.id, e.data.key, e.data.value);
      if (e.data?.type === "cms-key") onKey(e.data);
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  });
  useEffect(() => { if (ready.current) post({ type: "cms-blocks", blocks, selectedId }); }, [blocks, selectedId]);
  useEffect(() => { if (ready.current && scrollTo) post({ type: "cms-scroll", id: scrollTo.id }); }, [scrollTo]);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setBox(e.contentRect.width));
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  const px = Number(w);
  const scale = Math.min(1, box / px);
  return (
    <div className="flex flex-col h-full">
      <p className="text-xs text-foreground/40 mb-2">Klik — wybór bloku · dwuklik na tekście — edycja w miejscu · Ctrl+S zapis · Ctrl+Z cofnij · Delete usuń · Alt+↑/↓ przesuń · Ctrl+D duplikuj · Esc odznacz</p>
      <div className="flex gap-2 mb-3">
        {DEVICES.map(([v, Icon, l]) => (
          <button key={v} onClick={() => setW(v)} className={`min-h-[40px] px-3 inline-flex items-center gap-2 technical text-[10px] border ${w === v ? "border-[#C9A24A] gold-text" : "hairline text-foreground/50"}`}>
            <Icon className="h-4 w-4" /> {l} {v}
          </button>
        ))}
      </div>
      <div ref={wrap} className="flex-1 min-h-[70vh] border hairline overflow-hidden bg-black relative">
        <iframe ref={frame} title="Podgląd strony" src="/admin/podglad-strony"
          style={{ width: px, height: `${100 / scale}%`, transform: `scale(${scale})`, transformOrigin: "0 0", position: "absolute", left: Math.max(0, (box - px * scale) / 2), top: 0 }} />
      </div>
    </div>
  );
}