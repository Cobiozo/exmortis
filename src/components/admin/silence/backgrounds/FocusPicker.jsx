import React from "react";

// Kliknięcie na zdjęciu ustawia punkt skupienia (zostaje w kadrze na telefonie).
export default function FocusPicker({ src, x = 50, y = 50, onChange }) {
  const click = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    onChange(Math.round(((e.clientX - r.left) / r.width) * 100), Math.round(((e.clientY - r.top) / r.height) * 100));
  };
  return (
    <div>
      <p className="text-xs text-foreground/50 mb-2">Punkt skupienia — kliknij najważniejsze miejsce obrazu</p>
      <div className="relative inline-block cursor-crosshair" onClick={click}>
        <img src={src} alt="Podgląd zdjęcia tła" className="max-h-48 w-auto block" />
        <span className="absolute h-5 w-5 -ml-2.5 -mt-2.5 rounded-full border-2 border-[#C9A24A] pointer-events-none" style={{ left: `${x}%`, top: `${y}%` }} />
      </div>
    </div>
  );
}