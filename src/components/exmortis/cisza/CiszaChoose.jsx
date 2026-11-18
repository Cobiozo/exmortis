import React, { useRef } from "react";
import { ChevronDown } from "lucide-react";
import BackdropPicker from "./backdrop/BackdropPicker";
import { TIMES } from "./prefs";
import ViewSwitch from "./ViewSwitch";
import CiszaFrame from "./CiszaFrame";
import BrandButton from "@/components/exmortis/ui/BrandButton";
import { cn } from "@/lib/utils";

const STEP = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

// Ekran przed startem — tytuł, jedno zdanie, czas jako przyciski segmentowe,
// ustawienia dodatkowe schowane w „Ustawieniach”, główny przycisk „Zacznij”.
// Mieści się na jednym ekranie telefonu 375×667.
export default function CiszaChoose({ minutes, setMinutes, onStart, onLogo, view, onView, backdrops, backdropId, onBackdrop, introUrl, text }) {
  const refs = useRef([]);

  // Strzałki, Home i End wybierają czas w grupie (role="radiogroup").
  const onKey = (e, i) => {
    const step = STEP[e.key];
    let next = null;
    if (step) next = (i + step + TIMES.length) % TIMES.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TIMES.length - 1;
    if (next === null) return;
    e.preventDefault();
    setMinutes(TIMES[next]);
    refs.current[next]?.focus();
  };

  return (
    <CiszaFrame onLogo={onLogo} onHome={onLogo}>
      <div className="flex w-full max-w-xl flex-col items-center gap-3 text-center fade-up sm:gap-5 [@media(max-height:600px)]:gap-2">
        <h1 className="exm-h1">Chwila ciszy</h1>
        <p className="exm-lead max-w-[34ch]">{text || "Bez muzyki. Bez powiadomień. Tylko Ty i czas."}</p>

        <div role="radiogroup" aria-label="Czas ciszy" className="mt-1 grid w-full grid-cols-4 gap-2 sm:grid-cols-7">
          {TIMES.map((m, i) => {
            const on = minutes === m;
            return (
              <button
                key={m}
                ref={(el) => { refs.current[i] = el; }}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on ? 0 : -1}
                onClick={() => setMinutes(m)}
                onKeyDown={(e) => onKey(e, i)}
                className={cn(
                  "min-h-12 rounded-[var(--exm-r-field)] border text-[15px] font-medium tabular-nums transition-colors",
                  on
                    ? "border-exm-gold bg-[rgba(201,162,74,0.10)] text-exm-ivory"
                    : "border-exm-line-strong text-exm-muted hover:border-exm-gold-line hover:text-exm-ivory"
                )}
              >
                {m} min
              </button>
            );
          })}
        </div>

        <details className="group w-full">
          <summary className="mx-auto flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 rounded-[var(--exm-r-field)] px-3 text-[13px] font-medium text-exm-muted transition-colors hover:text-exm-ivory [&::-webkit-details-marker]:hidden">
            Ustawienia
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="mt-3 flex flex-col items-center gap-4">
            <ViewSwitch value={view} onChange={onView} />
            {backdrops.length > 1 && <BackdropPicker items={backdrops} value={backdropId} onChange={onBackdrop} />}
          </div>
        </details>

        <BrandButton onClick={onStart} className="mt-1 w-full max-w-xs">Zacznij</BrandButton>
        {introUrl && <audio src={introUrl} preload="auto" className="hidden" />}
      </div>
    </CiszaFrame>
  );
}