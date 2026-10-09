import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import SettingsCard, { BTN_PRIMARY, FOCUS } from "./SettingsCard";

export default function AccountDataCard({ me }) {
  const [saved, setSaved] = useState(me.imie || me.full_name || "");
  const [name, setName] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const dirty = name.trim() !== saved.trim() && name.trim() !== "";

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    await base44.auth.updateMe({ imie: name.trim() });
    setSaved(name.trim()); setBusy(false); setMsg("Zapisano.");
  };

  return (
    <SettingsCard title="Dane konta">
      <form onSubmit={save} className="space-y-6">
        <div>
          <label htmlFor="imie" className="block font-mono text-xs tracking-[0.18em] uppercase text-[#E2E2E2]/70 mb-2">Imię</label>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <input id="imie" value={name} onChange={(e) => { setName(e.target.value); setMsg(""); }}
              className={`flex-1 min-h-[44px] bg-transparent border border-[#3D3D3F] px-4 text-base focus:border-[#C9A24A] ${FOCUS}`} />
            <button disabled={!dirty || busy} className={BTN_PRIMARY}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Zapisz</button>
            {msg && <span role="status" className="text-sm text-[#C9A24A]">{msg}</span>}
          </div>
        </div>
        <div>
          <p className="font-mono text-xs tracking-[0.18em] uppercase text-[#E2E2E2]/70 mb-2">E-mail</p>
          <p>{me.email}</p>
        </div>
      </form>
    </SettingsCard>
  );
}