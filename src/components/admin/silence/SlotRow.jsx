import React, { useRef, useState } from "react";
import { Upload, Trash2, Loader2 } from "lucide-react";
import AudioPreview from "./AudioPreview";
import { fmt, uploadSlot, ST } from "./silenceUtils";

// Jeden slot: WSTĘP / MELODIA / ZAKOŃCZENIE.
export default function SlotRow({ t, slot, reload }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const url = t[`plik_${slot.key}`];

  const pick = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy(true);
    setErr("");
    try {
      await ST.update(t.id, await uploadSlot(slot.key, f));
      reload();
    } catch (x) {
      setErr(x.message);
    }
    setBusy(false);
  };

  const remove = async () => {
    await ST.updateMany({ id: t.id }, { $unset: { [`plik_${slot.key}`]: "", [`plik_${slot.key}_nazwa`]: "", [`dlugosc_${slot.key}_s`]: "" } });
    reload();
  };

  return (
    <div className="border-t hairline py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="technical text-[9px] text-foreground/50 w-24">{slot.label}</span>
        <span className={`technical text-[9px] ${url ? "gold-text" : "text-foreground/30"}`}>{url ? "WGRANY" : "BRAK"}</span>
        {url && <span className="text-xs text-foreground/60 truncate max-w-[160px]">{t[`plik_${slot.key}_nazwa`]} · {fmt(t[`dlugosc_${slot.key}_s`])}</span>}
        {url && <AudioPreview url={url} />}
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => input.current.click()} disabled={busy} className="inline-flex items-center gap-1 technical text-[9px] text-[#C9A24A] border border-[#C9A24A]/40 px-3 py-1.5">
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" strokeWidth={1.25} />} {url ? "ZAMIEŃ" : "WGRAJ"}
          </button>
          {url && (
            <button onClick={remove} className="p-1.5 text-foreground/40 hover:text-[#BC1E22]" aria-label="Usuń plik">
              <Trash2 className="h-4 w-4" strokeWidth={1.25} />
            </button>
          )}
        </div>
        <input ref={input} type="file" accept=".mp3,.m4a,audio/mpeg,audio/mp4,audio/x-m4a" className="hidden" onChange={pick} />
      </div>
      {err && <p className="text-xs text-[#E8C547] mt-2">{err}</p>}
    </div>
  );
}