import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { fullLabel, plNote } from "@/components/booking/bookingTime";

const STATUS = {
  POTWIERDZONA: "potwierdzona", ANULOWANA_KLIENT: "anulowana", ANULOWANA_ADMIN: "anulowana przez exmortis",
  ODBYLA_SIE: "odbyła się", NIEOBECNOSC: "nieobecność", PRZENIESIONA: "przeniesiona",
};
const call = (p) => base44.functions.invoke("bookingPublic", p).then((r) => r.data);

export default function SessionRow({ b, past, onReschedule, onChanged }) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const cancel = async () => {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      await call({ action: "cancel", booking_id: b.id, change_window_h: b.change_window_h });
      onChanged?.();
    } catch (e) {
      setErr(e?.response?.data?.error || "Nie udało się anulować.");
    }
    setBusy(false);
    setConfirm(false);
  };

  const note = plNote(b.starts_at);
  const active = !past && b.status === "POTWIERDZONA";
  return (
    <div className="border hairline p-5 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="relic-heading text-lg">{b.type}</p>
        <span className="technical text-[10px] text-foreground/55">{STATUS[b.status] || b.status}</span>
      </div>
      <p>{fullLabel(b.starts_at)}{note && <span className="text-foreground/55"> ({note})</span>}</p>
      {active && b.zoom_link && (
        <a href={b.zoom_link} target="_blank" rel="noreferrer" className="btn-relic text-[10px]">WEJDŹ NA SPOTKANIE</a>
      )}
      {active && !b.zoom_link && <p className="text-xs text-foreground/55">Link do spotkania pojawi się 15 minut przed terminem.</p>}
      {active && (b.can_change || b.can_cancel ? (
        <div className="flex flex-wrap gap-3 pt-1">
          {b.can_change && <button onClick={onReschedule} className="btn-ghost text-[10px]">PRZENIEŚ</button>}
          {b.can_cancel && (confirm ? (
            <span className="flex items-center gap-3">
              <span className="technical text-[10px] text-foreground/70">ANULOWAĆ TO SPOTKANIE?</span>
              <button onClick={cancel} disabled={busy} className="gold-text technical text-[10px]">{busy ? "ANULUJĘ…" : "TAK"}</button>
              <button onClick={() => setConfirm(false)} className="technical text-[10px] text-foreground/55">NIE</button>
            </span>
          ) : (
            <button onClick={() => setConfirm(true)} className="btn-ghost text-[10px]">ANULUJ</button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[#E8C547]">Do sesji zostało mniej niż {b.change_window_h || 24} godziny — napisz do mnie.</p>
      ))}
      {err && <p className="text-sm text-[#E8C547]" role="alert">{err}</p>}
    </div>
  );
}