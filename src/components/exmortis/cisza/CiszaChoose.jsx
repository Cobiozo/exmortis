import React from "react";
import BackdropPicker from "./backdrop/BackdropPicker";
import { TIMES } from "./prefs";
import ViewSwitch from "./ViewSwitch";
import CiszaFrame from "./CiszaFrame";

// Ekran przed startem — mieści się na jednym ekranie telefonu.
export default function CiszaChoose({ minutes, setMinutes, onStart, onLogo, view, onView, minutesOnly, onMinutesOnly, backdrops, backdropId, onBackdrop, introUrl, text }) {
  return (
    <CiszaFrame onLogo={onLogo}>
      <div className="w-full max-w-xl flex flex-col items-center text-center gap-4 sm:gap-6 fade-up">
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 w-full" role="radiogroup" aria-label="Czas ciszy">
          {TIMES.map((m) => (
            <button key={m} role="radio" aria-checked={minutes === m} onClick={() => setMinutes(m)}
              className={`py-3 shop-heading text-xl border transition-colors ${minutes === m ? "bg-[#C9A24A] border-[#C9A24A] text-[#0A0A0B]" : "border-[#C9A24A]/50 text-[#C9A24A] hover:border-[#C9A24A]"}`}>
              {m} min
            </button>
          ))}
        </div>
        <p className="text-sm text-[#F5EFE1]/80">{text || "Bez muzyki. Bez powiadomień. Tylko Ty i czas."}</p>
        <div className="flex flex-col items-center gap-2">
          <ViewSwitch value={view} onChange={onView} />
          {view !== "pasek" && (
            <label className="inline-flex items-center gap-2 text-xs text-foreground/55 cursor-pointer min-h-[32px]">
              <input type="checkbox" checked={minutesOnly} onChange={(e) => onMinutesOnly(e.target.checked)} className="h-5 w-5 shrink-0 accent-[#C9A24A]" />
              Same minuty
            </label>
          )}
        </div>
        {backdrops.length > 1 && <BackdropPicker items={backdrops} value={backdropId} onChange={onBackdrop} />}
        <button onClick={onStart} className="btn-relic">Zacznij</button>
        {introUrl && <audio src={introUrl} preload="auto" className="hidden" />}
      </div>
    </CiszaFrame>
  );
}