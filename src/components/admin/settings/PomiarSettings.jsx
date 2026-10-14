import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Activity } from "lucide-react";
import { Switch } from "@/components/ui/switch";

const inp = "w-full bg-transparent border hairline px-4 py-3 focus:border-[#C9A24A] focus:outline-none font-mono";

// Pomiar reklam (Meta Pixel + GA4). Skrypty wchodzą dopiero po zgodzie z banera cookies.
export default function PomiarSettings({ initial }) {
  const [f, setF] = useState(initial || {});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const qc = useQueryClient();

  const save = async () => {
    setBusy(true); setMsg(null);
    await base44.functions.invoke("adminSettings", { action: "save", target: "pomiar", data: f })
      .then(() => { setMsg({ ok: true, text: "Zapisano. Zdarzenia ruszają u osób z zgodą na cookies." }); qc.invalidateQueries({ queryKey: ["siteSettings"] }); })
      .catch((e) => setMsg({ ok: false, text: e?.response?.data?.error || "Nie udało się zapisać." }));
    setBusy(false);
  };

  return (
    <section className="border hairline p-6 md:p-8">
      <div className="flex items-center gap-3 mb-2"><Activity className="h-5 w-5 gold-text" /><h2 className="relic-heading text-xl">Pomiar</h2></div>
      <p className="text-sm text-foreground/50 mb-6">
        Meta Pixel i Google Analytics 4. Skrypty ładują się wyłącznie po zgodzie z banera cookies:
        analityczne → GA4, marketingowe → Pixel. Bez zgody nie wysyłamy nic.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="block technical text-[10px] text-foreground/60 mb-2">Meta Pixel ID (same cyfry)</span>
          <input value={f.pixel_id || ""} inputMode="numeric" onChange={(e) => setF({ ...f, pixel_id: e.target.value })} placeholder="123456789012345" className={inp} />
        </label>
        <label className="block">
          <span className="block technical text-[10px] text-foreground/60 mb-2">GA4 Measurement ID</span>
          <input value={f.ga4_id || ""} onChange={(e) => setF({ ...f, ga4_id: e.target.value })} placeholder="G-XXXXXXXXXX" className={inp} />
        </label>
      </div>
      <label className="flex items-center gap-3 mt-6">
        <Switch checked={!!f.wlaczony} onCheckedChange={(v) => setF({ ...f, wlaczony: v })} aria-label="Pomiar włączony" />
        <span className="text-sm text-foreground/70">Pomiar włączony</span>
      </label>
      <div className="flex flex-wrap items-center gap-4 mt-6">
        <button onClick={save} disabled={busy} className="btn-relic">{busy ? "ZAPISUJĘ…" : "ZAPISZ POMIAR"}</button>
        {msg && <span className={`text-sm ${msg.ok ? "gold-text" : "blood-text"}`}>{msg.text}</span>}
      </div>
    </section>
  );
}