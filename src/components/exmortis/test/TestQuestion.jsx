import React, { useEffect, useRef } from "react";
import { BrandButton } from "@/components/exmortis/ui";
import { Container } from "@/components/exmortis/ui";
import { SCALE } from "@/lib/quizScore";
import TestProgress from "./TestProgress";
import TestOptions from "./TestOptions";

// Karta jednego stwierdzenia. Stała wysokość (min-h) i nawigacja przy dolnej krawędzi karty,
// dzięki czemu kolejne pytania nie skaczą, a „Dalej” jest zawsze w tym samym miejscu.
export default function TestQuestion({ step, total, question, value, onChoose, onBack, onNext }) {
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);

  return (
    <Container narrow>
      <TestProgress step={step} total={total} />

      <section
        aria-labelledby="test-pytanie"
        className="flex min-h-[26rem] flex-col rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface p-5 sm:min-h-[30rem] sm:p-6 md:min-h-[34rem] md:p-8"
      >
        <p className="exm-eyebrow">Na ile odnajdujesz siebie w tym zdaniu?</p>
        <div className="mt-3 min-h-[7rem] sm:min-h-[5.5rem]">
          <h2 id="test-pytanie" ref={heading} tabIndex={-1} className="exm-h3 text-balance focus:outline-none">
            {question.text}
          </h2>
        </div>

        <TestOptions
          label={question.text}
          value={value}
          onChange={onChoose}
          options={SCALE.map((s) => ({ value: s.value, label: s.label }))}
        />

        {step === 1 && (
          <p className="mt-4 text-[13px] leading-relaxed text-exm-muted">
            Nie ma odpowiedzi dobrych ani złych. Odnieś zdanie do własnej historii i obecnego życia.
          </p>
        )}

        <div className="mt-auto flex flex-col-reverse gap-2 border-t border-exm-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <BrandButton variant="link" onClick={onBack}>Wstecz</BrandButton>
          <BrandButton onClick={onNext} disabled={value === null}>Dalej</BrandButton>
        </div>
      </section>
    </Container>
  );
}