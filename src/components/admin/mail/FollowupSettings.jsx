import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Switch } from "@/components/ui/switch";
import { X, Smartphone, Monitor } from "lucide-react";

// Ustawienia → Mail po spotkaniu: przełącznik i podgląd obu wersji (obecni / nieobecni).
export default function FollowupSettings() {
  const [on, setOn] = useState(null);
  const [pv, setPv] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    base44.functions.invoke("mailAdmin", { action: "followup" }).then((r) => setOn(!!r.data.wlaczone)).catch(() => setOn(true));
  }, []);
  const toggle = (v) => { setOn(v); base44.functions.invoke("mailAdmin", { action: "followup", wlaczone: v }).catch(() => setOn(!v)); };
  const show = async (variant) => {
    setBusy(true);
    try {
      const r = await base44.functions.invoke("mailAdmin", { action: "followup_preview", variant });
      setPv({ ...r.data, w: 390 });
    } finally { setBusy(false); }
  };
  if (on === null) return null;
  return (
    <section className="border hairline p-6 md:p-8 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="relic-heading text-xl">Mail po spotkaniu</h2>
          <p className="text-sm text-foreground/60 mt-2 max-w-3xl leading-relaxed">
            Dzień po spotkaniu online, od 9:00, każdy zapisany dostaje jeden list — bez nagrania. Osoby, które weszły do pokoju przez swój link:
            podziękowanie i pierwszy krok (test, najbliższe spotkanie). Osoby, które nie dołączyły: „Wczoraj Cię zabrakło — i to w porządku”
            i zaproszenie na najbliższe spotkanie. Obecność zapisuje się sama przy wejściu przez stronę dołączenia.
          </p>
        </div>
        <Switch checked={on} onCheckedChange={toggle} aria-label="Mail po spotkaniu" />
      </div>
      <div className="flex flex-wrap gap-3">
        <button onClick={() => show("obecny")} disabled={busy} className="btn-ghost !px-4 !py-2 disabled:opacity-60">Podgląd — byli</button>
        <button onClick={() => show("nieobecny")} disabled={busy} className="btn-ghost !px-4 !py-2 disabled:opacity-60">Podgląd — nie dołączyli</button>
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
