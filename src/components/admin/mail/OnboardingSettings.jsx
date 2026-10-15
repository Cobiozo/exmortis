import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Switch } from "@/components/ui/switch";
import { X, Smartphone, Monitor } from "lucide-react";

const STEPS = [[1, "Dzień 1 — jak korzystać"], [3, "Dzień 3 — pytanie"], [7, "Dzień 7 — co się zmieniło"], [14, "Dzień 14 — następny krok"]];
const TYPES = [["pdf", "E-book"], ["audio", "Audiobook"], ["kurs", "Kurs"]];

// Ustawienia → Listy po zakupie: przełącznik serii i podgląd każdego listu.
export default function OnboardingSettings() {
  const [on, setOn] = useState(null);
  const [type, setType] = useState("pdf");
  const [pv, setPv] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    base44.functions.invoke("mailAdmin", { action: "onboarding" }).then((r) => setOn(!!r.data.wlaczone)).catch(() => setOn(true));
  }, []);
  const toggle = (v) => { setOn(v); base44.functions.invoke("mailAdmin", { action: "onboarding", wlaczone: v }).catch(() => setOn(!v)); };
  const show = async (step) => {
    setBusy(true);
    try {
      const r = await base44.functions.invoke("mailAdmin", { action: "onboarding_preview", step, type });
      setPv({ ...r.data, w: 390 });
    } finally { setBusy(false); }
  };
  if (on === null) return null;
  return (
    <section className="border hairline p-6 md:p-8 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="relic-heading text-xl">Listy po zakupie</h2>
          <p className="text-sm text-foreground/60 mt-2 max-w-3xl leading-relaxed">
            Po opłaceniu e-booka, audiobooka, kursu lub pakietu kupujący dostaje cztery krótkie listy od Ciebie: dzień 1 — jak korzystać,
            dzień 3 — jedno pytanie do refleksji, dzień 7 — co się zmieniło (z prośbą o opinię), dzień 14 — następny krok.
            Wysyłka między 8 a 20, najwyżej jeden taki list na 36 godzin. Bez prezentów i zamówień ze zwrotem; każdy list ma link „Nie chcę tych listów”.
          </p>
        </div>
        <Switch checked={on} onCheckedChange={toggle} aria-label="Listy po zakupie" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="technical text-[10px] text-foreground/50 mr-2">PODGLĄD DLA:</span>
        {TYPES.map(([k, l]) => (
          <button key={k} onClick={() => setType(k)} className={`technical text-[10px] px-3 py-1.5 border ${type === k ? "border-[#C9A24A] gold-text" : "hairline text-foreground/60"}`}>{l.toUpperCase()}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {STEPS.map(([s, l]) => (
          <button key={s} onClick={() => show(s)} disabled={busy} className="btn-ghost !px-4 !py-2 disabled:opacity-60">{l}</button>
        ))}
      </div>
      {pv && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex flex-col items-center p-4 overflow-auto" role="dialog" aria-modal="true" aria-label="Podgląd listu">
          <div className="flex items-center gap-2 mb-3">
            <button onClick={() => setPv({ ...pv, w: 390 })} className={`btn-ghost !px-4 !py-2 ${pv.w === 390 ? "!border-[#C9A24A]" : ""}`}><Smartphone className="h-4 w-4" /> TELEFON</button>
            <button onClick={() => setPv({ ...pv, w: 720 })} className={`btn-ghost !px-4 !py-2 ${pv.w === 720 ? "!border-[#C9A24A]" : ""}`}><Monitor className="h-4 w-4" /> KOMPUTER</button>
            <button onClick={() => setPv(null)} className="btn-ghost !px-4 !py-2" aria-label="Zamknij podgląd"><X className="h-4 w-4" /></button>
          </div>
          <p className="text-xs text-foreground/60 mb-2 text-center max-w-md">Temat: <span className="text-foreground">{pv.subject}</span></p>
          <iframe title="Podgląd listu" srcDoc={pv.html} sandbox="" className="bg-[#0A0A0B] border hairline"
            style={{ width: Math.min(pv.w, typeof window !== "undefined" ? window.innerWidth - 32 : pv.w), height: "80vh" }} />
        </div>
      )}
    </section>
  );
}
