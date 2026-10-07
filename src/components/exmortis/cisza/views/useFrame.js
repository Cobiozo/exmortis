import { useEffect, useRef } from "react";

// Pętla rysowania: requestAnimationFrame (wstrzymywana przez przeglądarkę w ukrytej karcie),
// albo rzadkie odświeżanie co slowMs (przygaszenie, „ogranicz ruch”). Czas zawsze z zegara sesji.
export function useFrame(draw, slowMs = 0) {
  const ref = useRef(draw);
  ref.current = draw;
  useEffect(() => {
    if (slowMs) {
      ref.current(performance.now());
      const id = setInterval(() => ref.current(performance.now()), slowMs);
      return () => clearInterval(id);
    }
    let id;
    const loop = (t) => { ref.current(t); id = requestAnimationFrame(loop); };
    id = requestAnimationFrame(loop);
    const vis = () => document.visibilityState === "visible" && ref.current(performance.now());
    document.addEventListener("visibilitychange", vis);
    return () => { cancelAnimationFrame(id); document.removeEventListener("visibilitychange", vis); };
  }, [slowMs]);
}

export const mmss = (ms) => {
  const t = Math.max(0, Math.ceil(ms / 1000));
  return [String(Math.floor(t / 60)).padStart(2, "0"), String(t % 60).padStart(2, "0")];
};

export const minutesText = (ms) =>
  ms > 60000 ? `${Math.ceil(ms / 60000)} min` : ms > 0 ? "mniej niż minuta" : "0 min";

// Zegar podglądu (miniaturki, panel): pełny przebieg w zapętleniu.
export const loopClock = (periodMs, minutes = 10) => ({
  get: () => {
    const p = (performance.now() % periodMs) / periodMs;
    return { p, rem: (1 - p) * minutes * 60000, paused: false };
  },
});

export const fixedClock = (p, rem = 0) => ({ get: () => ({ p, rem, paused: false }) });