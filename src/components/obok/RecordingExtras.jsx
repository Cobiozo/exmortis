import React, { useState } from "react";

// Pytanie na wieczór, transkrypcja, materiał dodatkowy, numery pomocowe.
export default function RecordingExtras({ n }) {
  const [txt, setTxt] = useState(false);
  return (
    <div className="mt-10 space-y-8">
      {n.pytanie && (
        <div className="border border-[#C9A24A]/60 p-6 md:p-8">
          <p className="technical text-[10px] gold-text mb-3">PYTANIE NA WIECZÓR</p>
          <p className="shop-heading text-2xl text-[#F5EFE1] leading-snug">{n.pytanie}</p>
        </div>
      )}
      {n.transkrypcja && (
        <div>
          <button onClick={() => setTxt(!txt)} className="technical text-[10px] gold-text">{txt ? "UKRYJ TEKST" : "POKAŻ TEKST"}</button>
          {txt && <p className="mt-4 text-foreground/70 leading-relaxed whitespace-pre-line select-none">{n.transkrypcja}</p>}
        </div>
      )}
      {n.material_url && <a href={n.material_url} target="_blank" rel="noopener noreferrer" className="btn-ghost">{n.material_nazwa || "Materiał dodatkowy"}</a>}
      <p className="text-xs text-foreground/40 border-t hairline pt-6">Obok to mentoring, nie terapia. Jeśli jest Ci bardzo ciężko: 116 123 lub 800 70 2222 (całą dobę). W zagrożeniu życia: 112.</p>
    </div>
  );
}