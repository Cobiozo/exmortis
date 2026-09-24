import { useEffect, useState } from "react";

// Wspólne pomocniki Minutnika ciszy: ruch, czas, dźwięk końcowy.

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return reduced;
}

export function formatRemaining(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

let audioCtx = null;

// Odblokowanie AudioContext w momencie gestu użytkownika, żeby ton końcowy wybrzmiał.
export function unlockAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch {
    audioCtx = null;
  }
}

// Miękki, niski ton przypominający misę dźwiękową: sinus 220 Hz + alikwot 440 Hz,
// łagodny atak i wybrzmienie ok. 8 sekund, niska głośność. Zwraca długość w sekundach.
export function playBowlSound() {
  try {
    unlockAudio();
    const ctx = audioCtx;
    if (!ctx || ctx.state !== "running") return 0;
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(1, now + 0.8);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 8);
    master.connect(ctx.destination);
    [
      { freq: 220, level: 0.16 },
      { freq: 440, level: 0.06 },
    ].forEach(({ freq, level }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.value = level;
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + 8);
    });
    return 8;
  } catch {
    return 0;
  }
}