import React, { useEffect, useRef, useState } from "react";
import { useBottomBar } from "@/lib/bottomBar";

function Bar({ targetId, label }) {
  const ref = useRef(null);
  useBottomBar(ref);
  return (
    <div ref={ref} className="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-[#0A0A0B]/95 border-t hairline px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      <a href={`#${targetId}`} className="btn-relic w-full">{label}</a>
    </div>
  );
}

// Telefon: przycisk „Zapisz się” przyklejony na dole — znika, gdy formularz zapisu jest widoczny.
export default function StickySignup({ targetId = "zapis", label = "Zapisz się" }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setHidden(e.isIntersecting || e.boundingClientRect.top < 0), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, [targetId]);
  if (hidden) return null;
  return <Bar targetId={targetId} label={label} />;
}