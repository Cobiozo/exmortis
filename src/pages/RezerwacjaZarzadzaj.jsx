import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import SlotPicker from "@/components/booking/SlotPicker";
import { fullLabel, plNote, viewerTz } from "@/components/booking/bookingTime";

const call = (p) => base44.functions.invoke("bookingPublic", p).then((r) => r.data);

// MUSI 12: przeniesienie i anulowanie z linku. Token tylko we fragmencie adresu, jak w kroku 1.
export default function RezerwacjaZarzadzaj() {
  const [token, setToken] = useState("");
  const [b, setB] = useState(undefined);
  const [slots, setSlots] = useState(null);
  const [pick, setPick] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [slotsErr, setSlotsErr] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const load = useCallback(
    (tok) => call({ action: "manage", token: tok }).then((d) => setB(d.booking)).catch(() => setB(null)),
    []
  );

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "referrer"; meta.content = "no-referrer";
    document.head.appendChild(meta);
    const params = new URLSearchParams(window.location.hash.slice(1));
    const t = params.get("t") || "";
    // Link „Anuluj” z e-maila prowadzi tu z &a=anuluj — od razu otwieram potwierdzenie anulowania.
    setConfirmCancel(params.get("a") === "anuluj");
    setToken(t);
    window.history.replaceState(null, "", window.location.pathname);
    load(t);
    return () => meta.remove();
  }, [load]);

  const wantChange = () => {
    setErr(""); setMsg(""); setSlotsErr(false); setSlotsLoading(true);
    call({ action: "slots", manage_token: token })
      .then((d) => setSlots(d.slots))
      .catch(() => setSlotsErr(true))
      .finally(() => setSlotsLoading(false));
  };

  const doChange = async () => {
    if (!pick || busy) return;
    setBusy(true); setErr("");
    try {
      await call({ action: "reschedule", token, starts_at: pick.start, tz: viewerTz(), change_window_h: b.change_window_h });
      setMsg("Termin przeniesiony."); setSlots(null); setPick(null); await load(token);
    } catch (e) {
      setErr(e?.response?.data?.error || "Nie udało się przenieść.");
    }
    setBusy(false);
  };

  const doCancel = async () => {
    if (busy) return;
    setConfirmCancel(false);
    setBusy(true); setErr("");
    try {
      const r = await call({ action: "cancel", token, change_window_h: b.change_window_h });
      setMsg(r.in_time ? "Spotkanie anulowane. Sesja wróciła do pakietu." : "Spotkanie anulowane.");
      setSlots(null); await load(token);
    } catch (e) {
      setErr(e?.response?.data?.error || "Nie udało się anulować.");
    }
    setBusy(false);
  };

  const note = b && plNote(b.starts_at);
  return (
    <div className="pt-32 pb-24 container-exm">
      <div className="max-w-xl space-y-6">
        <p className="technical text-[10px] gold-text">TWOJA REZERWACJA</p>
        {msg && <p className="text-sm gold-text" role="status">{msg}</p>}
        {b === undefined && <p className="text-foreground/55">Sprawdzam…</p>}
        {b === null && (
          <div>
            <p className="text-foreground/70">Ten link jest nieważny albo rezerwacja została anulowana.</p>
            <p className="text-sm text-foreground/55 mt-3">
              Jeśli masz konto, swoje sesje zobaczysz w <Link to="/konto" className="gold-text underline">Moich sesjach</Link>.
            </p>
          </div>
        )}
        {b && (
          <>
            <h1 className="relic-heading text-3xl">{b.type}</h1>
            <p>{fullLabel(b.starts_at)}{note && <span className="text-foreground/55"> ({note})</span>}</p>
            {b.zoom_link
              ? <a href={b.zoom_link} target="_blank" rel="noreferrer" className="btn-relic text-[10px]">WEJDŹ NA SPOTKANIE</a>
              : <p className="text-xs text-foreground/55">Link do spotkania pojawi się 15 minut przed terminem.</p>}
            {b.can_change || b.can_cancel ? (
              <>
                <div className="flex flex-wrap gap-3">
                  {b.can_change && <button onClick={wantChange} className="btn-ghost text-[10px]">PRZENIEŚ</button>}
                  {b.can_cancel && !confirmCancel && <button onClick={() => setConfirmCancel(true)} disabled={busy} className="btn-ghost text-[10px]">ANULUJ</button>}
                </div>
                {b.can_cancel && confirmCancel && (
                  <div className="border border-[#5C1A1B] p-5 space-y-3">
                    <p className="text-sm">Anulować to spotkanie? Jeśli anulujesz w czasie dozwolonym, sesja wróci do pakietu.</p>
                    <div className="flex flex-wrap gap-3">
                      <button onClick={doCancel} disabled={busy} className="btn-blood text-[10px]">{busy ? "ANULUJĘ…" : "TAK, ANULUJ"}</button>
                      <button onClick={() => setConfirmCancel(false)} disabled={busy} className="btn-ghost text-[10px]">ZOSTAW</button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-[#E8C547]">Do sesji zostało mniej niż {b.change_window_h || 24} godziny — napisz do mnie.</p>
            )}
            {slotsLoading && slots === null && <p className="text-foreground/55">Ładuję terminy…</p>}
            {slotsErr && (
              <div className="border hairline p-6">
                <p role="alert" className="text-sm text-[#E8C547]">Nie udało się wczytać terminów. Sprawdź połączenie.</p>
                <button onClick={wantChange} className="btn-ghost mt-4 text-[10px]">SPRÓBUJ PONOWNIE</button>
              </div>
            )}
            {slots && (
              <div className="border border-[#C9A24A] p-6 space-y-5">
                <p className="relic-heading text-xl">Nowy termin</p>
                <SlotPicker slots={slots} value={pick} onPick={setPick} />
                <button onClick={doChange} disabled={!pick || busy} className="btn-relic text-[10px] disabled:opacity-50">{busy ? "PRZENOSZĘ…" : "PRZENIEŚ"}</button>
              </div>
            )}
            {err && <p className="text-sm text-[#E8C547]" role="alert">{err}</p>}
          </>
        )}
      </div>
    </div>
  );
}