import React, { useEffect, useRef, useState } from "react";
import { playBowlSound, formatRemaining } from "./motion";

const SENTENCES = [
  "Nie musisz nic robić. Wystarczy, że jesteś.",
  "Cisza nie jest brakiem hałasu. Jest miejscem, w którym słychać siebie.",
  "To, co przyjdzie, niech przyjdzie. To, co odejdzie, niech odejdzie.",
  "Nikt teraz niczego od Ciebie nie chce.",
  "W hałasie reagujesz. W ciszy wybierasz.",
];

const SESSION_URL = "https://exmortis-return-path.base44.app/functions/silenceSession";

// Ekran 3 — cisza: złota linia czasu, losowe zdanie, dyskretne sterowanie.
export default function CiszaSilence({ minutes, sound, source, backgroundUrl, outroUrl, onEnd, reduced }) {
  const durationMs = minutes * 60000;
  const [ratio, setRatio] = useState(1);
  const [remaining, setRemaining] = useState(durationMs);
  const [paused, setPaused] = useState(false);
  const [controls, setControls] = useState(false);
  const [sentenceOn, setSentenceOn] = useState(false);

  const endAtRef = useRef(Date.now() + durationMs);
  const pausedAtRef = useRef(null);
  const pausedRef = useRef(false);
  const endedRef = useRef(false);
  const hideTimerRef = useRef(null);
  const musicRef = useRef(null);
  const sentence = useRef(SENTENCES[Math.floor(Math.random() * SENTENCES.length)]).current;

  const showControls = () => {
    if (endedRef.current) return;
    setControls(true);
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControls(false), 3000);
  };

  const stopMusic = () => {
    const a = musicRef.current;
    musicRef.current = null;
    if (!a) return;
    if (reduced) {
      a.pause();
      return;
    }
    let v = a.volume;
    const fade = setInterval(() => {
      v -= 0.02;
      if (v <= 0) {
        clearInterval(fade);
        a.pause();
      } else {
        a.volume = v;
      }
    }, 100);
  };

  const finish = (completed) => {
    if (endedRef.current) return;
    endedRef.current = true;
    setControls(false);
    stopMusic();
    if (completed) {
      const bowlSec = playBowlSound();
      const waitMs = Math.max(1000, bowlSec * 1000 - 1200);
      if (outroUrl) {
        setTimeout(() => {
          const out = new Audio(outroUrl);
          out.volume = 0.9;
          out.play().catch(() => {});
          out.onended = () => onEnd(true);
          setTimeout(() => onEnd(true), 90000);
        }, waitMs);
      } else {
        setTimeout(() => onEnd(true), Math.max(1500, bowlSec * 1000));
      }
    } else {
      setTimeout(() => onEnd(false), reduced ? 400 : 1200);
    }
  };

  const togglePause = () => {
    if (endedRef.current) return;
    if (!pausedRef.current) {
      pausedAtRef.current = Date.now();
      pausedRef.current = true;
      musicRef.current?.pause();
      setPaused(true);
    } else {
      endAtRef.current += Date.now() - pausedAtRef.current;
      pausedRef.current = false;
      musicRef.current?.play().catch(() => {});
      setPaused(false);
    }
    showControls();
  };

  // Odliczanie ze znaczników czasu: koniec = start + czas trwania (dokładne po zablokowaniu ekranu).
  useEffect(() => {
    let raf;
    const tick = () => {
      if (!pausedRef.current && !endedRef.current) {
        const rem = endAtRef.current - Date.now();
        setRatio(Math.max(0, rem / durationMs));
        setRemaining(rem);
        if (rem <= 0) {
          finish(true);
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cicha muzyka w tle.
  useEffect(() => {
    if (backgroundUrl) {
      const a = new Audio(backgroundUrl);
      a.loop = true;
      a.volume = 0.25;
      a.play().catch(() => {});
      musicRef.current = a;
    }
    return () => stopMusic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Jedno losowe zdanie na 10 sekund.
  useEffect(() => {
    const show = setTimeout(() => setSentenceOn(true), reduced ? 0 : 300);
    const hide = setTimeout(() => setSentenceOn(false), 10300);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [reduced]);

  // Screen Wake Lock — ekran telefonu nie gaśnie.
  useEffect(() => {
    let lock = null;
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock?.request("screen");
      } catch {
        lock = null;
      }
    };
    acquire();
    const onVis = () => {
      if (document.visibilityState === "visible" && !endedRef.current) acquire();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      lock?.release?.().catch(() => {});
    };
  }, []);

  // Klawiatura i reakcja na ruch/dotyk.
  useEffect(() => {
    const onMove = () => showControls();
    const onKey = (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        togglePause();
      } else if (e.key === "Escape") {
        finish(false);
      } else {
        showControls();
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchstart", onMove);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchstart", onMove);
      window.removeEventListener("keydown", onKey);
      clearTimeout(hideTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Porzucona sesja (zamknięcie karty) — zapis „nie ukończono”.
  useEffect(() => {
    const onLeave = () => {
      if (endedRef.current) return;
      try {
        fetch(SESSION_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            duration_minutes: minutes,
            completed: false,
            sound_option: sound,
            source,
          }),
        }).catch(() => {});
      } catch {
        /* poniżej karty już nic nie zrobimy */
      }
    };
    window.addEventListener("pagehide", onLeave);
    return () => window.removeEventListener("pagehide", onLeave);
  }, [minutes, sound, source]);

  return (
    <section
      className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden"
      onClick={showControls}
    >
      <div className="h-px bg-[#C9A24A]" style={{ width: `${ratio * 40}%` }} />

      <p
        className={`absolute left-0 right-0 px-8 text-center text-sm md:text-base text-[#F5EFE1]/70 font-light italic transition-opacity ${
          sentenceOn ? "opacity-100" : "opacity-0"
        }`}
        style={{ bottom: "58%", transitionDuration: reduced ? "0ms" : "2000ms" }}
      >
        {sentence}
      </p>

      <div
        className={`absolute bottom-10 left-0 right-0 flex flex-col items-center gap-3 transition-opacity ${
          controls ? "opacity-100" : "opacity-0"
        }`}
        style={{ transitionDuration: reduced ? "0ms" : "1000ms" }}
      >
        <p className="technical text-[10px] text-[#F5EFE1]/50">
          POZOSTAŁO {formatRemaining(remaining)}
        </p>
        <div className="flex items-center gap-8">
          <button
            onClick={(e) => {
              e.stopPropagation();
              togglePause();
            }}
            className="technical text-[10px] text-[#F5EFE1]/60 hover:text-[#F5EFE1] transition-colors"
          >
            {paused ? "WZNÓW" : "PRZERWIJ"}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              finish(false);
            }}
            className="technical text-[10px] text-[#F5EFE1]/60 hover:text-[#F5EFE1] transition-colors"
          >
            ZAKOŃCZ
          </button>
        </div>
      </div>
    </section>
  );
}