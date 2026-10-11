import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { lib, plDateTime, inputCls } from "./libApi";

// Historia zmian (mb_log): filtr po rodzaju działania i okresie. E-maile przychodzą zamaskowane z serwera.
export default function HistoryPanel() {
  const [d, setD] = useState(null);
  const [action, setAction] = useState("");
  const [days, setDays] = useState("30");
  const [err, setErr] = useState("");

  useEffect(() => {
    setErr("");
    lib("history", { action_filter: action, days: Number(days) }).then(setD).catch((e) => { setErr(e.message); setD({ items: [], akcje: [] }); });
  }, [action, days]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <select value={action} onChange={(e) => setAction(e.target.value)} className={`${inputCls} max-w-[280px]`}>
          <option value="">Wszystkie działania</option>
          {(d?.akcje || []).map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={days} onChange={(e) => setDays(e.target.value)} className={`${inputCls} max-w-[200px]`}>
          <option value="7">Ostatnie 7 dni</option>
          <option value="30">Ostatnie 30 dni</option>
          <option value="365">Ostatni rok</option>
          <option value="3650">Wszystko</option>
        </select>
      </div>

      {err && <p className="text-sm blood-text">{err}</p>}
      <p className="text-xs text-foreground/45">Bez treści wiadomości. Adresy e-mail są maskowane (da***@gmail.com).</p>

      {!d ? <Loader2 className="h-5 w-5 animate-spin gold-text" /> : d.items.length === 0 ? (
        <p className="text-sm text-foreground/50">Brak wpisów dla tych filtrów.</p>
      ) : (
        <div className="border hairline divide-y divide-[#3D3D3F]/60">
          {d.items.map((r, i) => (
            <div key={`${r.at}-${i}`} className="p-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="text-[11px] text-foreground/40 w-[150px]">{plDateTime(r.at)}</span>
              <span className="technical text-[10px] gold-text min-w-[150px]">{r.action}</span>
              <span className="text-xs text-foreground/60 min-w-0 flex-1">{r.summary || "—"}</span>
              <span className="text-[11px] text-foreground/35">{r.actor}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}