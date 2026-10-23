import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { SLOTS, ST, uploadSlot } from "./silenceUtils";

// Nowy podkład: nazwa + opcjonalnie trzy pliki od razu.
export default function AddSoundtrackForm({ minutes, order, isFirst, onDone, onCancel }) {
  const [nazwa, setNazwa] = useState("");
  const [files, setFiles] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!nazwa.trim()) return setErr("Podaj nazwę.");
    setBusy(true);
    setErr("");
    try {
      const parts = await Promise.all(SLOTS.filter((s) => files[s.key]).map((s) => uploadSlot(s.key, files[s.key])));
      await ST.create({
        nazwa: nazwa.trim(), czas_min: minutes, kolejnosc: order, aktywny: true,
        zapetlaj_melodie: true, domyslny: isFirst, ...Object.assign({}, ...parts),
      });
      onDone();
    } catch (x) {
      setErr(x.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="border border-[#C9A24A]/40 p-4 mt-6 space-y-4">
      <p className="technical text-[10px] gold-text">NOWY PODKŁAD · {minutes} MIN</p>
      <input
        value={nazwa} onChange={(e) => setNazwa(e.target.value)} placeholder="Nazwa, np. Deszcz"
        className="w-full bg-transparent border hairline px-3 py-2 text-sm"
      />
      {SLOTS.map((s) => (
        <label key={s.key} className="flex flex-wrap items-center gap-3 text-xs text-foreground/60">
          <span className="technical text-[9px] w-24">{s.label}</span>
          <input type="file" accept=".mp3,.m4a,audio/mpeg,audio/mp4,audio/x-m4a" onChange={(e) => setFiles({ ...files, [s.key]: e.target.files?.[0] })} className="text-xs" />
        </label>
      ))}
      <p className="text-xs text-foreground/40">MP3 lub M4A, do 500 MB na plik. Pliki możesz też wgrać później.</p>
      {err && <p className="text-xs text-[#E8C547]">{err}</p>}
      <div className="flex gap-3">
        <button disabled={busy} className="btn-relic !py-3 !px-5">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Zapisz</button>
        <button type="button" onClick={onCancel} className="btn-ghost !py-3 !px-5">Anuluj</button>
      </div>
    </form>
  );
}