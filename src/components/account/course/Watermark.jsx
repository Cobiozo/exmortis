import React, { useEffect, useState } from "react";

const rnd = () => ({ top: 8 + Math.random() * 75, left: 5 + Math.random() * 60 });

// Dynamiczny znak wodny: główny (~15%) i słabszy (~6%), zmieniają miejsce co 20–40 s.
export default function Watermark({ text }) {
  const [a, setA] = useState(rnd);
  const [b, setB] = useState(rnd);
  useEffect(() => {
    let t;
    const move = () => { setA(rnd()); setB(rnd()); t = setTimeout(move, 20000 + Math.random() * 20000); };
    t = setTimeout(move, 20000 + Math.random() * 20000);
    return () => clearTimeout(t);
  }, []);
  const base = "pointer-events-none select-none absolute text-[11px] md:text-xs text-white whitespace-nowrap transition-all duration-1000";
  return (
    <>
      <span data-wm="1" aria-hidden="true" className={base} style={{ top: `${a.top}%`, left: `${a.left}%`, opacity: 0.15, zIndex: 20 }}>{text}</span>
      <span data-wm="2" aria-hidden="true" className={base} style={{ top: `${b.top}%`, left: `${b.left}%`, opacity: 0.06, zIndex: 20 }}>{text}</span>
    </>
  );
}