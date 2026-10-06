import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { ST, TIMES } from "./silenceUtils";

const FIELDS = ["plik_wstep", "plik_wstep_nazwa", "dlugosc_wstep_s", "plik_zakonczenie", "plik_zakonczenie_nazwa", "dlugosc_zakonczenie_s"];

// Kopiuje wstęp i zakończenie wybranego podkładu do innych czasów (melodia się nie kopiuje).
export default function CopyIntroOutro({ tracks, reload }) {
  const [srcId, setSrcId] = useState("");
  const [times, setTimes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const src = tracks.find((t) => t.id === srcId);

  const apply = async () => {
    setBusy(true);
    const patch = Object.fromEntries(FIELDS.filter((f) => src[f] != null).map((f) => [f, src[f]]));
    const targets = tracks.filter((t) => times.includes(t.czas_min));
    if (targets.length) await ST.bulkUpdate(targets.map((t) => ({ id: t.id, ...patch })));
    const empty = times.filter((m) => !tracks.some((t) => t.czas_min === m));
    if (empty.length) await ST.bulkCreate(empty.map((m) => ({ nazwa: src.nazwa, czas_min: m, aktywny: true, domyslny: true, zapetlaj_melodie: true, kolejnosc: 0, ...patch })));
    setMsg(`Skopiowano do: ${times.join(", ")} min.`);
    setTimes([]);
    setBusy(false);
    reload();
  };

  return (
    <div className="border hairline p-6 bg-[#0F0F10]">
      <h3 className="relic-heading text-2xl mb-2">Skopiuj wstęp i zakończenie do innych czasów</h3>
      <p className="text-xs text-foreground/50 mb-5">Pliki nie są wgrywane ponownie. Melodia się nie kopiuje.</p>
      <select value={srcId} onChange={(e) => { setSrcId(e.target.value); setTimes([]); setMsg(""); }} className="bg-[#0A0A0B] border hairline px-3 py-2 text-sm w-full md:w-auto">
        <option value="">Wybierz podkład…</option>
        {tracks.map((t) => <option key={t.id} value={t.id}>{t.czas_min} min · {t.nazwa}</option>)}
      </select>
      {src && (
        <div className="flex flex-wrap gap-4 mt-5">
          {TIMES.filter((m) => m !== src.czas_min).map((m) => (
            <label key={m} className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-[#C9A24A]" checked={times.includes(m)} onChange={(e) => setTimes(e.target.checked ? [...times, m] : times.filter((x) => x !== m))} />
              {m} min
            </label>
          ))}
        </div>
      )}
      {src && times.length > 0 && (
        <button onClick={apply} disabled={busy} className="btn-relic mt-5 !py-3">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Skopiuj</button>
      )}
      {msg && <p className="text-xs gold-text mt-4">{msg}</p>}
    </div>
  );
}