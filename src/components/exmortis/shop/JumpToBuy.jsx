import React from "react";
import { ArrowDown } from "lucide-react";

// Skrót przy cenie: przewija do formularza (darmowe) albo do zakupu (płatne) i ustawia fokus na pierwszym polu.
export default function JumpToBuy({ free, targetId = "kup-teraz" }) {
  const go = () => {
    const el = document.getElementById(targetId);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    setTimeout(() => el.querySelector("input:not([type=hidden]), select, textarea, button")?.focus({ preventScroll: true }), reduce ? 0 : 600);
  };
  return (
    <button type="button" onClick={go} className="btn-relic self-center !py-3 !px-6">
      {free ? "ODBIERZ TERAZ" : "KUP TERAZ"} <ArrowDown className="h-4 w-4" />
    </button>
  );
}