import { useEffect } from "react";

// Wysokość przyklejonych dolnych pasków (zapis na spotkanie, odtwarzacz podcastu) w zmiennej CSS
// --exm-bottom-bar. Przycisk „Nagła pomoc” unosi się nad pasek, zamiast go zasłaniać (audyt 17.11.2026, X-12).
// Pasek ukryty na danej szerokości (np. lg:hidden) ma wysokość 0 i nie przesuwa przycisku.
const bars = new Map();

function apply() {
  if (typeof document === "undefined") return;
  const h = Math.max(0, ...bars.values());
  document.documentElement.style.setProperty("--exm-bottom-bar", `${h}px`);
}

export function useBottomBar(ref) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const key = {};
    const update = () => { bars.set(key, el.offsetHeight || 0); apply(); };
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", update);
      bars.delete(key);
      apply();
    };
  }, [ref]);
}
