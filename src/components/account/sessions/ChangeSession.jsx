import React, { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import SlotPicker from "@/components/booking/SlotPicker";
import { fullLabel, plNote, viewerTz } from "@/components/booking/bookingTime";

const call = (p) => base44.functions.invoke("bookingPublic", p).then((r) => r.data);

// Przeniesienie terminu z konta — limit przełożeń i granica 24 h sprawdzane na serwerze.
export default function ChangeSession({ b, onClose, onChanged }) {
  const [slots, setSlots] = useState(null);
  const [pick, setPick] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () => call({ action: "slots", booking_id: b.id }).then((d) => setSlots(d.slots)).catch(() => setSlots([])),
    [b.id]
  );
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!pick || busy) return;
    setBusy(true); setErr("");
    try {
      await call({ action: "reschedule", booking_id: b.id, starts_at: pick.start, tz: viewerTz(), change_window_h: b.change_window_h });
      onChanged();
    } catch (e) {
      setErr(e?.response?.data?.error || "Nie udało się przenieść.");
      setBusy(false);
    }
  };

  return (
    <div className="border border-[#C9A24A] p-6 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <p className="relic-heading text-xl">Przenieś spotkanie</p>
        <button onClick={onClose} className="technical text-[10px] text-foreground/55">ZAMKNIJ</button>
      </div>
      <p className="text-sm text-foreground/60">Teraz: {fullLabel(b.starts_at)}</p>
      {slots === null
        ? <p className="text-foreground/55">Ładowanie terminów…</p>
        : <SlotPicker slots={slots} value={pick} onPick={setPick} />}
      {pick && (
        <p className="text-sm">Nowy termin: {fullLabel(pick.start)}{plNote(pick.start) && <span className="text-foreground/55"> ({plNote(pick.start)})</span>}</p>
      )}
      {err && <p className="text-sm text-[#E8C547]" role="alert">{err}</p>}
      <button onClick={save} disabled={!pick || busy} className="btn-relic text-[10px] disabled:opacity-50">{busy ? "PRZENOSZĘ…" : "PRZENIEŚ"}</button>
    </div>
  );
}