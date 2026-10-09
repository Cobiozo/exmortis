import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Hourglass } from "lucide-react";
import { useAdminMode } from "@/components/admin/AdminModeContext";
import { SIM_KEY } from "@/lib/usePrelaunch";
import { isoToWarsawLocal, warsawLocalToIso, fmtWarsaw } from "@/lib/warsawTime";
import DisableConfirm from "./DisableConfirm";

const inp = "dt-input relative bg-transparent border hairline px-4 py-3 focus:border-[#C9A24A] focus:outline-none";

// Tryb przedpremierowy: data końca, wyłączenie teraz, podgląd gościa i symulacja daty.
export default function PrelaunchSettings({ initial }) {
  const [p, setP] = useState(initial);
  const [local, setLocal] = useState(isoToWarsawLocal(initial.do));
  const [sim, setSim] = useState(sessionStorage.getItem(SIM_KEY) ? isoToWarsawLocal(sessionStorage.getItem(SIM_KEY)) : "");
  const [msg, setMsg] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { setMode } = useAdminMode();
  const active = !p.wylaczony && new Date() < new Date(p.do);

  const save = async (next, text) => {
    await base44.functions.invoke("adminSettings", { action: "save", target: "premiera", data: next })
      .then(() => { setP(next); setMsg({ ok: true, text }); qc.invalidateQueries({ queryKey: ["siteSettings"] }); })
      .catch((e) => setMsg({ ok: false, text: e?.response?.data?.error || "Nie udało się zapisać." }));
  };
  const preview = (simIso) => {
    if (simIso) sessionStorage.setItem(SIM_KEY, simIso); else sessionStorage.removeItem(SIM_KEY);
    setMode("guest"); navigate("/");
  };

  return (
    <section className="border hairline p-6 md:p-8">
      <div className="flex items-center gap-3 mb-2"><Hourglass className="h-5 w-5 gold-text" /><h2 className="relic-heading text-xl">Tryb przedpremierowy</h2></div>
      <p className={`text-sm mb-6 ${active ? "gold-text" : "text-foreground/50"}`}>
        {active ? `Włączony do ${fmtWarsaw(p.do)}. Goście widzą tylko zapowiedź, 1 listopada, Kontakt i dokumenty prawne.` : "Wyłączony. Goście widzą pełną stronę."}
      </p>
      <label className="block technical text-[10px] text-foreground/60 mb-2">Włączony do (czas polski)</label>
      <div className="flex flex-wrap gap-3 mb-6">
        <input type="datetime-local" value={local} onChange={(e) => setLocal(e.target.value)} className={inp} />
        <button onClick={() => save({ do: warsawLocalToIso(local), wylaczony: false }, "Zapisano datę. Tryb wyłączy się sam o tej godzinie.")} className="btn-ghost">ZAPISZ DATĘ</button>
      </div>
      <div className="flex flex-wrap gap-3 mb-8">
        {active && <button onClick={() => setConfirm(true)} className="btn-blood">WYŁĄCZ TRYB PRZEDPREMIEROWY TERAZ</button>}
        <button onClick={() => preview(null)} className="btn-ghost">PODGLĄD: JAK WIDZI TO GOŚĆ</button>
      </div>
      <label className="block technical text-[10px] text-foreground/60 mb-2">Podgląd w innym dniu (symulacja, tylko dla Ciebie)</label>
      <div className="flex flex-wrap gap-3">
        <input type="datetime-local" value={sim} onChange={(e) => setSim(e.target.value)} className={inp} />
        <button disabled={!sim} onClick={() => preview(warsawLocalToIso(sim))} className="btn-ghost">PODGLĄD W TYM DNIU</button>
        {sessionStorage.getItem(SIM_KEY) && <button onClick={() => { sessionStorage.removeItem(SIM_KEY); setSim(""); qc.invalidateQueries({ queryKey: ["siteSettings"] }); }} className="btn-ghost">WYŁĄCZ SYMULACJĘ</button>}
      </div>
      {msg && <p className={`text-sm mt-6 ${msg.ok ? "gold-text" : "blood-text"}`}>{msg.text}</p>}
      <DisableConfirm open={confirm} onOpenChange={setConfirm} onConfirm={() => save({ ...p, wylaczony: true }, "Tryb przedpremierowy wyłączony. Goście widzą pełną stronę.")} />
    </section>
  );
}