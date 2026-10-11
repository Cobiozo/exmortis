import React from "react";
import { dayKey, dayLabel, timeLabel, plNote, viewerTz } from "./bookingTime";

export default function SlotPicker({ slots, value, onPick }) {
  const days = [];
  for (const s of slots) {
    const k = dayKey(s.start);
    if (!days.length || days[days.length - 1].k !== k) days.push({ k, label: dayLabel(s.start), items: [] });
    days[days.length - 1].items.push(s);
  }
  if (!slots.length) return <p className="text-foreground/60">Brak wolnych terminów w najbliższym czasie. Zajrzyj później.</p>;
  const tz = viewerTz();
  return (
    <div className="space-y-6">
      {tz !== "Europe/Warsaw" && <p className="text-xs text-foreground/50">Godziny w Twojej strefie czasowej ({tz}).</p>}
      {days.map((d) => (
        <div key={d.k}>
          <p className="technical text-[10px] gold-text mb-2">{d.label}</p>
          <div className="flex flex-wrap gap-2">
            {d.items.map((s) => {
              const note = plNote(s.start);
              return (
                <button key={s.start} type="button" onClick={() => onPick(s)} aria-pressed={value?.start === s.start}
                  className={`px-4 py-2 border text-sm ${value?.start === s.start ? "border-[#C9A24A] bg-[#C9A24A] text-[#0A0A0B]" : "hairline hover:border-[#C9A24A]"}`}>
                  {timeLabel(s.start)}{note && <span className="block text-[10px] opacity-70">{note}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}