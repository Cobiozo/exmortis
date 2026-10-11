import React, { useState } from "react";
import { Ban } from "lucide-react";
import { bk } from "./api";

// MUSI 16: „Jestem niedostępny” — maksymalnie trzy kliknięcia z telefonu (otwórz, wybierz, gotowe).
const PRESETS = [
  ["do-konca-dnia", "Dziś do końca dnia"],
  ["2h", "Najbliższe 2 godziny"],
  ["jutro", "Jutro cały dzień"],
];

export default function UnavailableButton({ onDone }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const pick = async (preset) => {
    setBusy(preset); setErr(""); setMsg("");
    try {
      await bk("unavailable", { preset });
      setMsg("Zablokowane.");
      setOpen(false);
      onDone?.();
    } catch (e) {
      setErr(e.message);
    }
    setBusy("");
  };

  return (
    <div className="relative">
      <button onClick={() => { setOpen(!open); setMsg(""); }} className="btn-blood !py-3 text-[10px]">
        <Ban className="h-4 w-4" /> JESTEM NIEDOSTĘPNY
      </button>
      {open && (
        <div className="absolute z-30 mt-2 w-64 border border-[#BC1E22] bg-[#0A0A0B] p-2 space-y-1">
          {PRESETS.map(([k, l]) => (
            <button key={k} onClick={() => pick(k)} disabled={!!busy}
              className="block w-full text-left px-3 py-3 text-sm hover:bg-[#151516] disabled:opacity-50">
              {busy === k ? "Blokuję…" : l}
            </button>
          ))}
        </div>
      )}
      {msg && <p className="text-xs gold-text mt-2" role="status">{msg}</p>}
      {err && <p className="text-xs text-[#E8C547] mt-2" role="alert">{err}</p>}
    </div>
  );
}