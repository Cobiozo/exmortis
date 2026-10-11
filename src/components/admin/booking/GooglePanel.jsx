import React, { useEffect, useState } from "react";
import { bk, plDateTime } from "./api";

// MUSI 6: status połączenia, przełącznik zajętości i instrukcja odłączenia.
export default function GooglePanel() {
  const [g, setG] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => bk("google_status").then((r) => setG(r.google)).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const toggle = async () => {
    setBusy(true); setErr("");
    try { await bk("save_google", { busy: !g.busy }); await load(); } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const make = async () => {
    setBusy(true); setErr("");
    try { await bk("google_calendar"); await load(); } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  if (err && !g) return <p className="blood-text text-sm">{err}</p>;
  if (!g) return <p className="text-sm text-foreground/50">Ładowanie…</p>;

  return (
    <section className="border hairline p-5 space-y-4">
      <p className="technical text-[10px] gold-text">KALENDARZ GOOGLE</p>
      <p className="text-sm">
        {g.connected ? <span className="gold-text">Połączono</span> : <span className="blood-text">Brak połączenia</span>}
        {g.account && <span className="text-foreground/60"> · {g.account}</span>}
      </p>
      <p className="text-xs text-foreground/50">Zakresy: {g.scopes.join(", ")}</p>
      <p className="text-xs text-foreground/50">
        Kalendarz „exmortis · sesje”: {g.calendar_id ? <span className="font-mono">{g.calendar_id}</span> : "jeszcze nie utworzony"}
      </p>
      {!g.calendar_id && <button onClick={make} disabled={busy} className="btn-ghost !py-2 text-[10px]">{busy ? "TWORZĘ…" : "UTWÓRZ KALENDARZ"}</button>}

      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" checked={g.busy} disabled={busy} onChange={toggle} />
        Uwzględniaj zajętość z Google
      </label>

      {(g.status === "error" || g.pending > 0) && (
        <p className="text-xs blood-text">
          {g.status === "error" ? "Kalendarz Google niedostępny — sprawdź zajętość ręcznie." : `${g.pending} zmian czeka na ponowienie.`}
          {g.error ? ` (${g.error})` : ""}
        </p>
      )}
      {g.status === "ok" && g.status_at && <p className="text-xs text-foreground/40">Ostatnie sprawdzenie: {plDateTime(g.status_at)}</p>}

      <div className="text-xs text-foreground/50 border-t hairline pt-4 space-y-1">
        <p className="technical text-[10px] text-foreground/40">ODŁĄCZENIE</p>
        <p>Na koncie Google: Bezpieczeństwo → Uprawnienia aplikacji → usuń dostęp. Aplikacja przestanie widzieć zajętość i zapisywać wydarzenia, dopóki nie połączysz jej ponownie.</p>
        <p>Pełnego dostępu do kalendarzy aplikacja nie ma i mieć nie będzie — tylko własny kalendarz i odczyt zajętości.</p>
      </div>
    </section>
  );
}