import React, { useEffect, useRef } from "react";
import { BrandButton, Container } from "@/components/exmortis/ui";
import { STAGES } from "@/lib/quizScore";
import TestProgress from "./TestProgress";
import TestOptions from "./TestOptions";

// Ostatnie pytanie testu — wybór etapu drogi. Nazwa etapu (Śmierć, Próg, Powrót…) nie jest pokazywana
// przy odpowiedziach: podpowiadałaby wybór. Wybór etapu nie wpływa na wynik punktowy.
export default function TestStage({ step, total, value, onChoose, onBack, onNext }) {
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);

  return (
    <Container narrow>
      <TestProgress step={step} total={total} />

      <section
        aria-labelledby="test-etap-pytanie"
        className="flex flex-col rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface p-5 sm:p-6 md:p-8"
      >
        <p className="exm-eyebrow">Zatrzymaj się jeszcze przy jednym pytaniu</p>
        <h2 id="test-etap-pytanie" ref={heading} tabIndex={-1} className="exm-h3 mt-3 text-balance focus:outline-none">
          Gdzie jesteś na swojej drodze?
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-exm-muted">
          Nie pytam, jak długo trwa Twoja historia. Pytam, w którym miejscu siebie dzisiaj odnajdujesz.
        </p>

        <TestOptions
          label="Gdzie jesteś na swojej drodze?"
          value={value}
          onChange={onChoose}
          options={STAGES.map((o) => ({ value: o.key, label: o.text }))}
        />

        <div className="mt-auto flex flex-col-reverse gap-2 border-t border-exm-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <BrandButton variant="link" onClick={onBack}>Wstecz</BrandButton>
          <BrandButton onClick={onNext} disabled={!value}>Zobacz wynik</BrandButton>
        </div>
      </section>
    </Container>
  );
}