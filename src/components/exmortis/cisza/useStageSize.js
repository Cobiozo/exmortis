import { useEffect, useRef, useState } from "react";

// Rozmiar sceny z miejsca, które naprawdę zostaje w strefie środkowej:
// min(70% szerokości, wysokość − rezerwa na czas pod sceną − odstęp).
export default function useStageSize(reserve) {
  const ref = useRef(null);
  const [size, setSize] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      setSize(Math.max(80, Math.floor(Math.min(width * 0.7, height - reserve - 16))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [reserve]);
  return [ref, size];
}