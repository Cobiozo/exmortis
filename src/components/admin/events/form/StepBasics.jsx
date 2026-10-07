import React, { useState } from "react";
import RichTextEditor from "@/components/admin/RichTextEditor";
import { Field, Input, Group, Chips, inputCls } from "./ui";
import { EVENT_TYPES, STAGES } from "./eventForm";

import TermFields from "./TermFields";

const DUR = [45, 60, 90, 120];

export default function StepBasics(p) {
  const { form: f, set, touch, errors } = p;
  const [other, setOther] = useState(!DUR.includes(Number(f.duration_minutes)));
  return (
    <div className="space-y-8">
      <Group title="Opis spotkania">
        <Input id="title" label="Tytuł *" {...p} />
        <Input id="subtitle" label="Jedno zdanie pod tytułem" {...p} />
        <div className="grid md:grid-cols-2 gap-5">
          <Field id="event_type" label="Typ spotkania">
            <select id="event_type" value={f.event_type} onChange={(e) => set({ event_type: e.target.value })} className={`${inputCls} bg-[#0D0D0E]`}>
              {EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field id="stage" label="Etap drogi">
            <select id="stage" value={f.stage} onChange={(e) => set({ stage: e.target.value })} className={`${inputCls} bg-[#0D0D0E]`}>
              {STAGES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
        </div>
        <Input id="for_whom" label="Dla kogo" placeholder="Dla tych, którzy…" {...p} />
        <Field id="description" label="Opis (co się wydarzy, jak się przygotować)">
          <div className="rich-admin rich-mobile"><RichTextEditor value={f.description} onChange={(v) => set({ description: v })} /></div>
        </Field>
      </Group>
      <Group title="Termin">
        <TermFields {...p} />
        <Field id="duration_minutes" label="Czas trwania" error={errors.duration_minutes}>
          <Chips label="Czas trwania" value={other ? "inny" : Number(f.duration_minutes)}
            options={[...DUR.map((m) => [m, `${m} min`]), ["inny", "inny"]]}
            onChange={(v) => { if (v === "inny") setOther(true); else { setOther(false); set({ duration_minutes: v }); } }} />
          {other && <input id="duration_minutes" type="number" min="5" inputMode="numeric" aria-label="Czas trwania w minutach" value={f.duration_minutes}
            onChange={(e) => set({ duration_minutes: e.target.value })} onBlur={() => touch("duration_minutes")} className={`${inputCls} mt-3 sm:max-w-[200px]`} />}
        </Field>
      </Group>
    </div>
  );
}