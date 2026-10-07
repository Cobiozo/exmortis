import React, { useState } from "react";
import RichTextEditor from "@/components/admin/RichTextEditor";
import { Field, Input, Group, Chips, inputCls } from "./ui";
import { EVENT_TYPES, STAGES } from "./eventForm";

const DUR = [45, 60, 90, 120];
const summary = (f) => {
  if (!f.date || !f.time) return "";
  const d = new Date(`${f.date}T${f.time}`);
  if (isNaN(d)) return "";
  return `${new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d)}, ${new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", hour: "2-digit", minute: "2-digit" }).format(d)} (czas polski)`;
};

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
        <div className="grid sm:grid-cols-2 gap-5">
          <Input id="date" type="date" label="Data *" {...p} />
          <Input id="time" type="time" label="Godzina *" {...p} />
        </div>
        {summary(f) && <p className="gold-text text-sm -mt-2">{summary(f)}</p>}
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