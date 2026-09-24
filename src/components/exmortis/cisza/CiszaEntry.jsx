import React, { useEffect, useRef, useState } from "react";

// Ekran 2 — wejście (8 sekund): oddech, ewentualnie intro z moim głosem.
export default function CiszaEntry({ introUrl, onDone, reduced }) {
  const [visible, setVisible] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    if (introUrl) {
      const a = new Audio(introUrl);
      a.volume = 0.9;
      a.play().catch(() => {});
      audioRef.current = a;
    }
    const appear = setTimeout(() => setVisible(true), reduced ? 0 : 100);
    const hide = setTimeout(() => setVisible(false), reduced ? 7000 : 5500);
    const done = setTimeout(() => onDone(), 8000);
    return () => {
      [appear, hide, done].forEach(clearTimeout);
      audioRef.current?.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="fixed inset-0 bg-[#0A0A0B] flex items-center justify-center px-8">
      <p
        className={`text-xl md:text-2xl text-[#F5EFE1]/85 font-light text-center max-w-lg leading-relaxed transition-opacity ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        style={{ transitionDuration: reduced ? "0ms" : "1500ms" }}
      >
        Usiądź wygodnie. Weź jeden głębszy oddech.
      </p>
    </section>
  );
}