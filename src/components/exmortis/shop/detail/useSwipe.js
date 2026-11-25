import { useRef } from "react";

// Przesunięcie palcem w lewo/prawo (galeria produktu): zwraca uchwyty dotyku dla elementu.
// Ruch krótszy niż 40 px albo bardziej pionowy niż poziomy (przewijanie strony) jest pomijany.
export default function useSwipe(onLeft, onRight) {
  const start = useRef(null);
  return {
    onTouchStart: (e) => { const t = e.touches[0]; start.current = { x: t.clientX, y: t.clientY }; },
    onTouchEnd: (e) => {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      if (dx < 0) onLeft(); else onRight();
    },
  };
}
