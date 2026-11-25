import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import SettingsCard, { FOCUS, LINK } from "./SettingsCard";

// E-maile o nowych materiałach w Bibliotece (np. nagrania z Wieczorów powrotu) — włącz / wyłącz.
export default function LibMailCard() {
  const [on, setOn] = useState(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const call = async (action) => {
    setBusy(true);
    const r = await base44.functions.invoke("mySettings", { action }).catch(() => ({ data: {} }));
    setBusy(false);
    if (typeof r.data?.on === "boolean") { setOn(r.data.on); setFailed(false); } else setFailed(true);
  };
  useEffect(() => { call("lib_mail"); }, []);

  return (
    <SettingsCard title="E-mail o nowych nagraniach">
      {on === null && failed ? (
        <p className="text-sm text-[#E2E2E2]/70">Nie udało się wczytać tego ustawienia. <button type="button" onClick={() => call("lib_mail")} disabled={busy} className={`${LINK} text-sm`}>Spróbuj ponownie</button></p>
      ) : on === null ? <Loader2 className="h-5 w-5 animate-spin text-[#C9A24A]" aria-label="Wczytywanie" /> : (
        <button type="button" role="switch" aria-checked={on} onClick={() => call(on ? "lib_mail_off" : "lib_mail_on")} disabled={busy}
          className={`w-full flex items-center gap-4 min-h-[44px] py-2 text-left cursor-pointer group ${FOCUS}`}>
          <span className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${on ? "bg-[#C9A24A]" : "bg-[#5A5A5C]"}`}>
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-[#0A0A0B] transition-all ${on ? "left-6" : "left-1"}`} />
          </span>
          <span className="group-hover:text-[#C9A24A] transition-colors">{on ? "Włączone" : "Wyłączone"}</span>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        </button>
      )}
      <p className="text-sm text-[#E2E2E2]/70 mt-2">Krótki e-mail, gdy w Twojej Bibliotece pojawi się nowe nagranie, np. z Wieczoru powrotu.</p>
    </SettingsCard>
  );
}
