import React from "react";

export const CISZA_LOGO = "https://media.base44.com/images/public/6aa08bc6318b0f886cc3b9a3/cecb69dea_logogrupaeq26.png";

// Znak + napis EXMORTIS, zawsze w 100%. Wysokość z --logo-h (clamp w CSS).
export default function CiszaLogo({ onClick }) {
  return (
    <button onClick={onClick} aria-label="exmortis — strona główna" className="flex items-center gap-[calc(var(--logo-h)*0.18)]" style={{ height: "var(--logo-h)" }}>
      <span className="relative block overflow-hidden" style={{ height: "var(--logo-h)", width: "var(--logo-h)" }}>
        <img src={CISZA_LOGO} srcSet={`${CISZA_LOGO} 2x, ${CISZA_LOGO} 3x`} alt="" className="absolute -inset-[18%] w-[136%] h-[136%] max-w-none object-contain" />
      </span>
      <span className="font-heading uppercase tracking-[0.18em] text-[#F5EFE1]" style={{ fontSize: "calc(var(--logo-h) * 0.36)" }}>Exmortis</span>
    </button>
  );
}