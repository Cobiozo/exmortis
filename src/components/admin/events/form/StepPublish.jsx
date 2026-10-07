import React from "react";
import EventPreview from "./EventPreview";
import { Group, Input } from "./ui";
import { allErrors, STEPS } from "./eventForm";

// Krok 4: podsumowanie braków przed publikacją + podgląd (na telefonie/tablecie tu jest jedyny podgląd).
export default function StepPublish(p) {
  const { form: f, goStep } = p;
  const errs = allErrors(f, true);
  const list = Object.entries(errs);
  const stepOf = (k) => (["title", "date", "time", "duration_minutes"].includes(k) ? 0 : k === "cover_alt" ? 1 : 2);
  return (
    <div className="space-y-8">
      <Group title="Przed publikacją">
        {list.length === 0 ? (
          <p className="text-sm gold-text">Wszystko gotowe do publikacji.</p>
        ) : (
          <ul className="space-y-2">
            {list.map(([k, m]) => (
              <li key={k}><button type="button" onClick={() => goStep(stepOf(k), k)} className="text-left text-sm text-[#E5484D] underline min-h-[44px]">{m} — krok „{STEPS[stepOf(k)]}”</button></li>
            ))}
          </ul>
        )}
        {!f.cover?.src && <p className="text-xs text-foreground/50">Bez okładki spotkanie pokaże się jako elegancki kafelek z datą.</p>}
        {f.status === "Odwołane" && <Input id="cancel_reason" label="Powód odwołania (dostaną go zapisani)" {...p} />}
      </Group>
      <div className="lg:hidden"><EventPreview form={f} /></div>
    </div>
  );
}