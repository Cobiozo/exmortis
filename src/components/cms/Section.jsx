import React from "react";

const BG = { czern: "bg-[#0A0A0B]", grafit: "bg-[#070708] border-y hairline", bordo: "bg-[#2A0D0E]", zdjecie: "bg-[#0A0A0B]" };
const PAD = { maly: "py-12 md:py-16", sredni: "py-16 md:py-24", duzy: "py-32", xl: "py-24 md:py-40" };
const W = { waska: "max-w-4xl", standard: "max-w-[1400px]", pelna: "max-w-none" };

// Wspólna oprawa sekcji: tło, odstępy, szerokość, wyrównanie.
export default function Section({ u = {}, spine, children }) {
  const full = u.szerokosc === "pelna";
  const img = u.tlo === "zdjecie" && u.tlo_zdjecie?.url;
  return (
    <section className={`relative overflow-hidden ${full ? "" : "px-5 md:px-10"} ${BG[u.tlo] || BG.czern} ${PAD[u.odstep] || PAD.duzy} ${u.wyrownanie === "srodek" ? "text-center" : ""}`}>
      {img && (
        <>
          <img src={u.tlo_zdjecie.url} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: `${u.tlo_zdjecie.fx ?? 50}% ${u.tlo_zdjecie.fy ?? 50}%` }} />
          <div className="absolute inset-0 bg-[#0A0A0B]" style={{ opacity: (u.przyciemnienie ?? 60) / 100 }} />
        </>
      )}
      {spine && <div className="absolute left-0 top-0 bottom-0 w-px spine opacity-30" />}
      <div className={`relative mx-auto ${W[u.szerokosc] || W.standard}`}>{children}</div>
    </section>
  );
}