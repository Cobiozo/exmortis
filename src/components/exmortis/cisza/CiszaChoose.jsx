import React, { useEffect, useState } from "react";

const BUTTON_MIN = [3, 5, 10, 15, 30, 60];

// Ekran 1 — wybór czasu i dźwięku.
export default function CiszaChoose({ minutes, setMinutes, sound, setSound, settings, onStart, reduced }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), 80);
    return () => clearTimeout(t);
  }, []);

  const fade = { transitionDuration: reduced ? "0ms" : "1500ms" };
  const buttons = BUTTON_MIN.includes(minutes) ? BUTTON_MIN : [...BUTTON_MIN, minutes];

  const options = [
    { key: "cisza", label: "Tylko cisza", show: true },
    { key: "glos", label: "Mój głos na początek i koniec", show: !!settings?.has_voice },
    { key: "muzyka", label: "Cicha muzyka w tle", show: !!settings?.has_music },
  ].filter((o) => o.show);

  return (
    <section
      className="min-h-screen flex flex-col items-center justify-center px-6 py-24 transition-opacity"
      style={{ ...fade, opacity: shown ? 1 : 0 }}
    >
      <div className="w-full max-w-2xl text-center">
        <h1 className="shop-heading text-4xl md:text-6xl text-[#F5EFE1]">Chwila ciszy</h1>
        <p className="mt-6 text-foreground/60 leading-relaxed max-w-xl mx-auto">
          Kiedy nauczysz się siedzieć w ciszy dłużej niż trzy minuty, zaczynasz słyszeć
          rzeczy, których hałas nie pozwalał Ci usłyszeć. Wybierz czas. Resztę zostaw mnie.
        </p>

        <div className="mt-14 flex flex-wrap justify-center gap-4">
          {buttons.map((m) => (
            <button
              key={m}
              onClick={() => setMinutes(m)}
              className={`w-28 md:w-32 py-5 shop-heading text-2xl border transition-colors duration-700 ${
                minutes === m
                  ? "bg-[#C9A24A] border-[#C9A24A] text-[#0A0A0B]"
                  : "border-[#C9A24A]/60 text-[#C9A24A] hover:border-[#C9A24A]"
              }`}
            >
              {m} min
            </button>
          ))}
        </div>

        {settings && (
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {options.map((o) => (
              <button
                key={o.key}
                onClick={() => setSound(o.key)}
                className={`px-5 py-2.5 technical text-[9px] border transition-colors duration-700 ${
                  sound === o.key
                    ? "border-[#C9A24A] gold-text"
                    : "hairline text-foreground/40 hover:text-foreground/70"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}

        <button onClick={onStart} className="btn-relic mt-12">
          Zaczynam
        </button>

        <p className="mt-8 text-xs text-foreground/35 max-w-md mx-auto leading-relaxed">
          Najlepiej usiądź, połóż telefon obok i nie blokuj ekranu — dźwięk na końcu da Ci
          znać, że czas minął.
        </p>
      </div>
    </section>
  );
}