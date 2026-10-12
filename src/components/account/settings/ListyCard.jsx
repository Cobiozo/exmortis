import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import SettingsCard, { FOCUS, LINK } from "./SettingsCard";

const LABEL = { on: "Włączone — list w każdy poniedziałek", off: "Wyłączone", pending: "Czeka na potwierdzenie — sprawdź skrzynkę" };

export default function ListyCard() {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [failed, setFailed] = useState(false);
  const call = async (action) => {
    setBusy(true); setMsg("");
    const r = await base44.functions.invoke("mySettings", { action }).catch((e) => ({ data: e.response?.data || {} }));
    setBusy(false);
    if (r.data.state) setState(r.data.state);
    return r.data;
  };
  // Błąd odczytu → komunikat z ponowieniem zamiast nieskończonego kółka.
  const loadState = () => { setFailed(false); call("listy").then((d) => { if (!d.state) setFailed(true); }); };
  useEffect(loadState, []);

  const toggle = async () => {
    if (busy || state === null) return;
    if (state === "off") await call("listy_on");
    else { const d = await call("listy_off"); if (!d.error) setMsg("Wyłączono. Nie wyślemy więcej Listów."); }
  };
  const resend = async () => { const d = await call("listy_resend"); setMsg(d.error || "Wysłano ponownie. Sprawdź skrzynkę."); };
  const on = state === "on" || state === "pending";

  return (
    <SettingsCard title="Listy powrotu">
      {state === null && failed ? (
        <p className="text-sm text-[#E2E2E2]/70">Nie udało się wczytać ustawienia. <button type="button" onClick={loadState} disabled={busy} className={`${LINK} text-sm`}>Spróbuj ponownie</button></p>
      ) : state === null ? <Loader2 className="h-5 w-5 animate-spin text-[#C9A24A]" aria-label="Wczytywanie" /> : (
        <button type="button" role="switch" aria-checked={on} onClick={toggle} disabled={busy}
          className={`w-full flex items-center gap-4 min-h-[44px] py-2 text-left cursor-pointer group ${FOCUS}`}>
          <span className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${state === "on" ? "bg-[#C9A24A]" : state === "pending" ? "bg-[#C9A24A]/50" : "bg-[#5A5A5C]"}`}>
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-[#0A0A0B] transition-all ${on ? "left-6" : "left-1"}`} />
          </span>
          <span className="group-hover:text-[#C9A24A] transition-colors">{LABEL[state]}</span>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        </button>
      )}
      {state === "pending" && <button type="button" onClick={resend} disabled={busy} className={`${LINK} text-sm`}>Wyślij ponownie</button>}
      <p className="text-sm text-[#E2E2E2]/70 mt-2">Jeden list w każdy poniedziałek. Możesz wyłączyć w każdej chwili.</p>
      {msg && <p role="status" className="text-sm text-[#C9A24A] mt-3">{msg}</p>}
    </SettingsCard>
  );
}