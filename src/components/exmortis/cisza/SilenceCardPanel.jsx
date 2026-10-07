import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { makeSilenceCard } from "./silenceCard";

// Cichy link „Zapisz kartę ciszy” → podgląd, Pobierz, Udostępnij (telefon).
export default function SilenceCardPanel({ stageRef, view, minutes }) {
  const [card, setCard] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  const make = async () => {
    setBusy(true);
    setErr(false);
    const blob = await makeSilenceCard(stageRef.current, view, minutes).catch(() => null);
    setBusy(false);
    if (!blob) { setErr(true); return; }
    const file = new File([blob], `cisza-${minutes}-min.png`, { type: "image/png" });
    setCard({ file, url: URL.createObjectURL(blob) });
    base44.analytics.track({ eventName: "cisza_karta_zapisana" });
  };

  const share = () => navigator.share({ files: [card.file] }).catch(() => {});
  const canShare = card && navigator.canShare?.({ files: [card.file] });
  const link = "text-xs text-foreground/45 hover:text-[#C9A24A] transition-colors";

  if (!card) {
    return (
      <div className="mt-10">
        <button onClick={make} disabled={busy} className={link}>{busy ? "Przygotowuję…" : "Zapisz kartę ciszy"}</button>
        {err && <p className="mt-2 text-xs text-foreground/35">Nie udało się przygotować karty</p>}
      </div>
    );
  }
  return (
    <div className="mt-8 flex flex-col items-center gap-4">
      <img src={card.url} alt={`Karta ciszy: ${minutes} minut ciszy`} className="h-48 w-auto border border-[#C9A24A]/20" />
      <div className="flex gap-6">
        <a href={card.url} download={card.file.name} className={link}>Pobierz</a>
        {canShare && <button onClick={share} className={link}>Udostępnij</button>}
      </div>
    </div>
  );
}