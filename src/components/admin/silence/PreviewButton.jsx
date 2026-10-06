import React, { useRef, useState } from "react";
import { Headphones, Square } from "lucide-react";
import { SilenceAudio } from "@/components/exmortis/cisza/audioEngine";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// "Przetestuj jak gość": wstęp → 20 s melodii → zakończenie, te same przejścia co na stronie.
export default function PreviewButton({ t, fadeMs }) {
  const [step, setStep] = useState("");
  const eng = useRef(null);

  const run = async () => {
    const e = new SilenceAudio({ volume: 0.8 });
    eng.current = e;
    if (t.plik_wstep) { setStep("Wstęp"); await e.playOnce(t.plik_wstep); }
    if (eng.current !== e) return;
    if (t.plik_melodia) {
      setStep("Melodia (20 s)");
      e.startMelody(t.plik_melodia, t.zapetlaj_melodie !== false, 0, fadeMs);
      await wait(20000 - fadeMs);
      e.stopMelody(fadeMs);
      await wait(fadeMs);
    }
    if (eng.current !== e) return;
    if (t.plik_zakonczenie) { setStep("Zakończenie"); await e.playOnce(t.plik_zakonczenie); }
    if (eng.current === e) setStep("");
  };

  const stop = () => { eng.current?.stopAll(500); eng.current = null; setStep(""); };

  return step ? (
    <button onClick={stop} className="inline-flex items-center gap-2 technical text-[9px] text-[#C9A24A]">
      <Square className="h-3 w-3" strokeWidth={1.25} /> {step.toUpperCase()} · ZATRZYMAJ
    </button>
  ) : (
    <button onClick={run} className="inline-flex items-center gap-2 technical text-[9px] text-foreground/60 hover:text-[#C9A24A]">
      <Headphones className="h-4 w-4" strokeWidth={1.25} /> PRZETESTUJ JAK GOŚĆ
    </button>
  );
}