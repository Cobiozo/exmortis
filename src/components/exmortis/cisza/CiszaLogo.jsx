import React from "react";
import { Image } from "@/components/ui/image";

export const CISZA_LOGO = "https://media.base44.com/images/public/6aa08bc6318b0f886cc3b9a3/cecb69dea_logogrupaeq26.png";

// Mały znak exmortis u góry na środku. Plik ma puste marginesy — kadrujemy powiększeniem.
export default function CiszaLogo({ opacity = 0.85, hidden, onClick, slow }) {
  return (
    <button
      onClick={onClick}
      aria-label="exmortis — strona główna"
      tabIndex={hidden ? -1 : 0}
      className="relative block h-[26px] w-[26px] sm:h-[34px] sm:w-[34px] overflow-hidden"
      style={{ opacity: hidden ? 0 : opacity, pointerEvents: hidden ? "none" : "auto", transition: `opacity ${slow ? 3000 : 700}ms ease` }}
    >
      <Image src={CISZA_LOGO} alt="" className="absolute -inset-[18%] w-[136%] h-[136%]" fittingType="fit" />
    </button>
  );
}