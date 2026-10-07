import React, { useEffect, useState } from "react";
import { Calendar, Clock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Field, inputCls } from "./ui";
import { wawToDate, autoDeadline } from "./eventForm";
import { quickDates, QUICK_TIMES, termSummary } from "./dateQuick";

const chip = "min-h-[36px] px-3 border hairline text-xs text-foreground/60 hover:border-[#C9A24A] hover:text-[#C9A24A]";

// Data | Godzina (od 640 px dwie kolumny), szybkie wybory, linia podsumowania i ostrzeżenia.
export default function TermFields({ form: f, set, touch, errors }) {
  const start = f.date && f.time ? wawToDate(f.date, f.time) : null;
  const [clash, setClash] = useState(false);
  const pick = (patch) => {
    const n = { ...f, ...patch };
    set({ ...patch, ...(f.deadline_manual ? {} : { registration_deadline: autoDeadline(n.date, n.time) }) });
  };
  const [taken, setTaken] = useState([]);
  useEffect(() => {
    base44.functions.invoke("eventsAdmin", { action: "list" })
      .then((r) => setTaken((r.data.events || []).filter((e) => e.id !== f.id && e.status !== "Odwołane" && e.start_datetime).map((e) => new Date(e.start_datetime).getTime())))
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setClash(!!start && taken.includes(start.getTime())); }, [start?.getTime(), taken]); // eslint-disable-line react-hooks/exhaustive-deps

  const warn = [];
  if (f.date && new Date(`${f.date}T12:00Z`).getUTCDay() === 0) warn.push("Niedziela — dzień ciszy w kalendarzu marki");
  if (f.time && (f.time < "07:00" || f.time > "22:00")) warn.push("Spotkanie przed 7:00 lub po 22:00");
  if (clash) warn.push("Inne spotkanie jest już zaplanowane na ten sam dzień i godzinę");

  const box = (id, type, Icon, extra) => (
    <div className="relative">
      <input id={id} type={type} lang="pl-PL" value={f[id] ?? ""} onChange={(e) => pick({ [id]: e.target.value })} onBlur={() => touch(id)}
        aria-invalid={!!errors[id]} className={`${inputCls} dt-input min-w-[200px] bg-[#0D0D0E] pr-12`} {...extra} />
      <Icon className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#C9A24A]" strokeWidth={1.5} />
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field id="date" label="Data *" error={errors.date}>
          {box("date", "date", Calendar)}
          <div className="flex flex-wrap gap-2 mt-2">{quickDates().map(([l, v]) => <button key={l} type="button" className={chip} onClick={() => { pick({ date: v }); touch("date"); }}>{l}</button>)}</div>
        </Field>
        <Field id="time" label="Godzina *" error={errors.time}>
          {box("time", "time", Clock, { step: 300 })}
          <div className="flex flex-wrap gap-2 mt-2">{QUICK_TIMES.map((t) => <button key={t} type="button" className={chip} onClick={() => { pick({ time: t }); touch("time"); }}>{t}</button>)}</div>
        </Field>
      </div>
      {start && <p className="text-sm text-[#F5EFE1]/85">{termSummary(f.date, f.time, f.duration_minutes, start)}</p>}
      {warn.map((w) => <p key={w} className="text-sm text-[#E8C547] border border-[#E8C547]/30 px-3 py-2">{w}</p>)}
    </div>
  );
}