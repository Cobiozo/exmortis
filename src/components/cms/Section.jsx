import React from "react";
import SafeImg from "./SafeImg";

const BG = { czern: "bg-[#0A0A0B]", grafit: "bg-[#070708] border-y hairline", surface: "bg-exm-surface border-y hairline", bordo: "bg-[#2A0D0E]", zdjecie: "bg-[#0A0A0B]" };
// „token” = odstęp z tokenu marki (--exm-section-y), wspólny dla całej strony.
// Wszystkie odstępy bloków wynikają z tokenu (88 px komputer / 56 px telefon) — „duży” = token (wcześniej stałe 128 px,
// co między dwoma blokami dawało ponad 250 px pustego pasa). Proporcje: mały 0,5 · średni 0,75 · duży 1 · XL 1,25.
const PAD = {
  maly: "py-[calc(var(--exm-section-y)*0.5)]",
  sredni: "py-[calc(var(--exm-section-y)*0.75)]",
  duzy: "py-[var(--exm-section-y)]",
  xl: "py-[calc(var(--exm-section-y)*1.25)]",
  token: "py-[var(--exm-section-y)]",
};
const W = { waska: "max-w-4xl", czytanie: "max-w-[var(--exm-container-narrow)]", standard: "max-w-[1400px]", pelna: "max-w-none" };

// Wspólna oprawa sekcji: tło, odstępy, szerokość, wyrównanie.
export default function Section({ u = {}, spine, children }) {
  const full = u.szerokosc === "pelna";
  const img = u.tlo === "zdjecie" && u.tlo_zdjecie?.url;
  return (
    <section className={`relative overflow-hidden ${full ? "" : "px-5 md:px-10"} ${BG[u.tlo] || BG.czern} ${PAD[u.odstep] || PAD.duzy} ${u.wyrownanie === "srodek" ? "text-center" : ""}`}>
      {img && (
        <>
          <SafeImg img={{ ...u.tlo_zdjecie, alt: "" }} className="!absolute inset-0" />
          <div className="absolute inset-0 bg-[#0A0A0B]" style={{ opacity: (u.przyciemnienie ?? 60) / 100 }} />
        </>
      )}
      {spine && <div className="absolute left-0 top-0 bottom-0 w-px spine opacity-30" />}
      <div className={`relative mx-auto ${W[u.szerokosc] || W.standard}`}>{children}</div>
    </section>
  );
}