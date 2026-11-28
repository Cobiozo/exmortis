import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { bk, plDateTime } from "./api";
import { confirmDialog } from "@/components/admin/ui/confirmDialog";

// Wynik powrotu z Google (?google=…) — jedno zdanie dla Dawida.
const RESULT = {
  ok: ["Kalendarz Google połączony.", false],
  przerwano: ["Połączenie przerwane w oknie Google.", true],
  brak_zgody: ["Google nie dał zgody na kalendarz — przy łączeniu zaznacz oba uprawnienia kalendarza.", true],
  blad_konfiguracji: ["Brak konfiguracji klienta Google albo sekretu GOOGLE_CLIENT_SECRET.", true],
  blad_sesji: ["Nieprawidłowa sesja łączenia — spróbuj ponownie.", true],
  sesja_wygasla: ["Sesja łączenia wygasła — spróbuj ponownie.", true],
  blad_tokenu: ["Google nie wydał tokenu — sprawdź adres przekierowania w Google Cloud i spróbuj ponownie.", true],
  blad: ["Nie udało się połączyć kalendarza — spróbuj ponownie.", true],
};
const gcal = async (action) => {
  try { return (await base44.functions.invoke("googleCalendarAuth", { action })).data; }
  catch (e) { throw new Error(e?.response?.data?.error || "Nie udało się."); }
};

// MUSI 6: status połączenia, przełącznik zajętości i instrukcja odłączenia.
export default function GooglePanel() {
  const [g, setG] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => bk("google_status").then((r) => setG(r.google)).catch((e) => setErr(e.message));
  const [result] = useState(() => { try { return RESULT[new URLSearchParams(window.location.search).get("google")] || null; } catch { return null; } });
  useEffect(() => { load(); }, []);

  const connect = async () => {
    setBusy(true); setErr("");
    try { const r = await gcal("start"); window.location.assign(r.url); } catch (e) { setErr(e.message); setBusy(false); }
  };
  const disconnect = async () => {
    if (!(await confirmDialog("Odłączyć kalendarz Google? Rezerwacje przestaną uwzględniać Twoją zajętość i nie będą zapisywane w kalendarzu.", "Odłącz"))) return;
    setBusy(true); setErr("");
    try { await gcal("disconnect"); await load(); } catch (e) { setErr(e.message); }
    setBusy(false);
  };

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
      {result && <p className={`text-sm ${result[1] ? "blood-text" : "gold-text"}`}>{result[0]}</p>}
      {err && g && <p className="text-sm blood-text">{err}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={connect} disabled={busy} className="btn-relic !py-2 text-[11px] disabled:opacity-50">
          {g.saved ? "Połącz ponownie" : "Połącz z Google"}
        </button>
        {g.saved && <button type="button" onClick={disconnect} disabled={busy} className="btn-ghost !py-2 text-[10px] disabled:opacity-50">Odłącz</button>}
      </div>
      <p className="text-xs text-foreground/50">Zakresy: {g.scopes.join(", ")}</p>
      <p className="text-xs text-foreground/50">
        Kalendarz „exmortis · sesje”: {g.calendar_id ? <span className="font-mono">{g.calendar_id}</span> : "jeszcze nie utworzony"}
      </p>
      {!g.calendar_id && g.connected && <button onClick={make} disabled={busy} className="btn-ghost !py-2 text-[10px]">{busy ? "Tworzę…" : "Utwórz kalendarz"}</button>}

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
        <p>Przycisk „Odłącz” unieważnia dostęp od razu. Można też na koncie Google: Bezpieczeństwo → Uprawnienia aplikacji → usuń dostęp. Aplikacja przestanie widzieć zajętość i zapisywać wydarzenia, dopóki nie połączysz jej ponownie.</p>
        <p>Pełnego dostępu do kalendarzy aplikacja nie ma i mieć nie będzie — tylko własny kalendarz i odczyt zajętości.</p>
      </div>
    </section>
  );
}