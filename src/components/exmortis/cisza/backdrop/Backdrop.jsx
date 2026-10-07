import React, { useEffect, useRef, useState } from "react";
import BackdropLayer from "./BackdropLayer";

// Tło strony ciszy z przenikaniem przy zmianie (800 ms przed startem, 1,5 s w trakcie).
export default function Backdrop({ bg, fadeMs = 800, dim, reduced, zoomMs = 0, contained, portrait }) {
  const n = useRef(0);
  const [layers, setLayers] = useState([{ id: bg.id, bg, key: 0 }]);

  useEffect(() => {
    setLayers((ls) => {
      if (ls[ls.length - 1].id === bg.id) return ls;
      n.current += 1;
      return [...ls.slice(-1), { id: bg.id, bg, key: n.current }];
    });
  }, [bg.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (layers.length < 2) return;
    const t = setTimeout(() => setLayers((l) => l.slice(-1)), reduced ? 0 : fadeMs);
    return () => clearTimeout(t);
  }, [layers, fadeMs, reduced]);

  return (
    <div
      aria-hidden="true"
      className={`${contained ? "absolute" : "fixed"} inset-0 overflow-hidden transition-[filter] duration-1000`}
      style={{ filter: dim ? "brightness(0.35)" : "none" }}
    >
      {layers.map((l, i) => (
        <BackdropLayer
          key={l.key} bg={i === layers.length - 1 ? bg : l.bg} animate={l.key > 0} fadeMs={reduced ? 1 : fadeMs}
          still={dim} reduced={reduced} zoomMs={zoomMs} portrait={portrait}
        />
      ))}
    </div>
  );
}