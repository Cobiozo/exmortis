import React, { useEffect, useRef, useState } from "react";

// Podgląd tylko do odczytu w ramce o rzeczywistej szerokości, skalowany do kolumny.
export default function CompareFrame({ blocks, width, title }) {
  const wrap = useRef(null);
  const frame = useRef(null);
  const [box, setBox] = useState(500);
  const send = () => frame.current?.contentWindow?.postMessage({ type: "cms-blocks", blocks, selectedId: null }, window.location.origin);
  useEffect(() => {
    const on = (e) => { if (e.source === frame.current?.contentWindow && e.data?.type === "cms-ready") send(); };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  });
  useEffect(send, [blocks]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setBox(e.contentRect.width));
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);
  const scale = Math.min(1, box / width);
  return (
    <div className="min-w-0">
      <p className="technical text-[10px] gold-text mb-2">{title}</p>
      <div ref={wrap} className="h-[65vh] border hairline overflow-hidden bg-black relative">
        <iframe ref={frame} title={title} src="/admin/podglad-strony" className="pointer-events-none"
          style={{ width, height: `${100 / scale}%`, transform: `scale(${scale})`, transformOrigin: "0 0", position: "absolute", left: Math.max(0, (box - width * scale) / 2), top: 0 }} />
      </div>
    </div>
  );
}