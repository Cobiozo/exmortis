import React, { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import SlotPicker from "@/components/booking/SlotPicker";
import { bk, plDateTime } from "./api";

const VIEWS = [["dzien", "Dzień"], ["tydzien", "Tydzień"], ["lista", "Lista"]];
const ST = {
  POTWIERDZONA: "potwierdzona", ANULOWANA_KLIENT: "anulowana przez klienta", ANULOWANA_ADMIN: "anulowana przez admina",
  PRZENIESIONA: "przełożona", ODBYLA_SIE: "odbyła się", NIEOBECNOSC: "nieobecność",
};
const MARK = [["ODBYLA_SIE", "ODBYŁA SIĘ"], ["NIEOBECNOSC", "NIEOBECNOŚĆ"], ["PRZENIESIONA", "PRZEŁOŻONA"]];

const warsawDay = (iso) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
const dayLabel = (ymd) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Warsaw" });

// Początek polskiej doby dla dnia przesuniętego o `off` dni. Liczony przez porównanie czasu polskiego,
// więc poprawnie przechodzi przez zmianę czasu (wcześniej okno dnia startowało w godzinie otwarcia panelu,
// przez co poranne terminy wypadały z widoku).
function warsawDayStart(off) {
  const ymd = new Date(Date.now() + off * 864e5).toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
  let t = new Date(`${ymd}T00:00:00Z`).getTime();
  for (let i = 0; i < 2; i++) {
    const local = new Date(t).toLocaleString("sv-SE", { timeZone: "Europe/Warsaw" });
    if (local.slice(0, 10) === ymd && local.slice(11, 16) === "00:00") break;
    const dayDiff = (local.slice(0, 10) < ymd ? -1 : local.slice(0, 10) > ymd ? 1 : 0) * 864e5;
    const [hh, mm] = local.slice(11, 16).split(":").map(Number);
    t -= dayDiff + (hh * 60 + mm) * 60000;
  }
  return t;
}

// MUSI 16: kalendarz dnia, tygodnia i listy. Rezerwacje (z oznaczeniem), spotkania grupowe (tylko odczyt), blokady.
export default function BookingCalendar() {
  const [view, setView] = useState("dzien");
  const [off, setOff] = useState(0);
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [move, setMove] = useState(null);      // {booking_id, type_id, slots, pick}
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    let from, to;
    if (view === "tydzien") {
      from = new Date(Date.now() + off * 7 * 864e5 - 12 * 3600e3);
      to = new Date(from.getTime() + 8 * 864e5);
    } else {
      from = new Date(warsawDayStart(off));
      to = new Date(from.getTime() + 864e5);
    }
    try {
      setD(await bk("calendar", { from: from.toISOString(), to: to.toISOString() }));
    } catch (e) { setErr(e.message); setD({ bookings: [], events: [], blocks: [], unmarked: 0 }); }
  }, [view, off]);
  useEffect(() => { load(); }, [load]);

  const startMove = async (b) => {
    setErr(""); setMove({ booking_id: b.id, type_id: b.type_id, title: b.type, slots: null, pick: null });
    const r = await bk("slots", { type_id: b.type_id }).catch((e) => { setErr(e.message); return { slots: [] }; });
    setMove((m) => (m ? { ...m, slots: r.slots } : m));
  };
  const doMove = async () => {
    if (!move?.pick) return;
    setBusy(true); setErr("");
    try {
      await bk("reschedule", { booking_id: move.booking_id, starts_at: move.pick.start });
      setMove(null); await load();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const mark = async (id, status) => {
    setErr("");
    try { await bk("mark_status", { booking_id: id, status }); await load(); } catch (e) { setErr(e.message); }
  };
  const resend = async (id) => {
    setErr(""); setMsg("");
    try { await bk("send_mail", { booking_id: id, kind: "potwierdzenie" }); setMsg("Potwierdzenie wysłane."); } catch (e) { setErr(e.message); }
  };
  const exportCsv = async () => {
    setErr("");
    try {
      const r = await bk("export_csv");
      const blob = new Blob(["\ufeff" + r.csv], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "rezerwacje.csv"; a.click();
    } catch (e) { setErr(e.message); }
  };

  const items = !d ? [] : [
    ...d.bookings.map((b) => ({ ...b, kind: "rez" })),
    ...d.events.map((e) => ({ ...e, kind: "grupa", first_name: "spotkanie grupowe", type: e.title })),
    ...d.blocks.map((x) => ({ ...x, kind: "blok", type: x.note || "Zajęte", first_name: "" })),
  ].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  const shown = view === "dzien"
    ? items.filter((x) => warsawDay(x.starts_at) === warsawDay(new Date(Date.now() + off * 864e5).toISOString()))
    : items;
  const days = [...new Set(shown.map((x) => warsawDay(x.starts_at)))];

  const row = (x) => {
    const past = new Date(x.ends_at || x.starts_at) < new Date();
    return (
      <div key={x.kind + x.id} className="border hairline p-3 text-sm space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-xs text-foreground/60">{plDateTime(x.starts_at)}</span>
          <span className={x.kind === "grupa" ? "gold-text" : x.kind === "blok" ? "blood-text" : ""}>{x.type}</span>
          {x.first_name && <span className="text-foreground/50 text-xs">{x.first_name}</span>}
          {x.kind === "rez" && <span className="text-[10px] technical text-foreground/40 ml-auto">{ST[x.status] || x.status}</span>}
          {x.kind === "grupa" && <span className="text-[10px] technical text-foreground/40 ml-auto">tylko odczyt</span>}
        </div>
        {x.kind === "rez" && x.status === "POTWIERDZONA" && (
          <div className="flex flex-wrap gap-2">
            {past
              ? MARK.map(([s, l]) => (
                  <button key={s} onClick={() => mark(x.id, s)} className="technical text-[9px] px-3 py-2 border hairline hover:border-[#C9A24A]">{l}</button>
                ))
              : (
                <>
                  <button onClick={() => startMove(x)} className="technical text-[9px] px-3 py-2 border hairline hover:border-[#C9A24A]">PRZENIEŚ</button>
                  <button onClick={() => resend(x.id)} className="technical text-[9px] px-3 py-2 border hairline hover:border-[#C9A24A]">WYŚLIJ POTWIERDZENIE</button>
                </>
              )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {VIEWS.map(([k, l]) => (
          <button key={k} onClick={() => { setView(k); setOff(0); }} className={`technical text-[10px] px-4 py-2 border ${view === k ? "border-[#C9A24A] gold-text" : "hairline text-foreground/60"}`}>{l}</button>
        ))}
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => setOff((o) => o - 1)} className="p-2 border hairline hover:border-[#C9A24A]" aria-label="Wcześniej"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => setOff(0)} className="technical text-[10px] px-3 py-2 border hairline hover:border-[#C9A24A]">DZIŚ</button>
          <button onClick={() => setOff((o) => o + 1)} className="p-2 border hairline hover:border-[#C9A24A]" aria-label="Później"><ChevronRight className="h-4 w-4" /></button>
          <button onClick={exportCsv} className="technical text-[10px] px-3 py-2 border hairline hover:border-[#C9A24A]"><Download className="h-3 w-3 inline" /> CSV</button>
        </div>
      </div>

      {err && <p className="text-sm text-[#E8C547]" role="alert">{err}</p>}
      {msg && <p className="text-sm gold-text" role="status">{msg}</p>}
      {!d && <p className="text-sm text-foreground/50">Ładowanie…</p>}
      {d && shown.length === 0 && <p className="text-sm text-foreground/40">Nic w tym zakresie.</p>}

      {view === "tydzien" ? (
        <div className="grid md:grid-cols-7 gap-3">
          {days.map((day) => (
            <div key={day} className="space-y-2">
              <p className="technical text-[9px] gold-text">{dayLabel(day)}</p>
              {shown.filter((x) => warsawDay(x.starts_at) === day).map(row)}
            </div>
          ))}
        </div>
      ) : view === "dzien" ? (
        <div className="space-y-2">{shown.map(row)}</div>
      ) : (
        <div className="space-y-6">
          {days.map((day) => (
            <div key={day} className="space-y-2">
              <p className="technical text-[9px] gold-text">{dayLabel(day)}</p>
              {shown.filter((x) => warsawDay(x.starts_at) === day).map(row)}
            </div>
          ))}
        </div>
      )}

      {move && (
        <div className="border border-[#C9A24A] p-6 space-y-5">
          <p className="relic-heading text-xl">Nowy termin — {move.title}</p>
          {!move.slots ? <p className="text-sm text-foreground/50">Szukam terminów…</p>
            : <SlotPicker slots={move.slots} value={move.pick} onPick={(p) => setMove((m) => ({ ...m, pick: p }))} />}
          <div className="flex gap-3">
            <button onClick={doMove} disabled={!move.pick || busy} className="btn-relic !py-3 text-[10px] disabled:opacity-50">{busy ? "PRZENOSZĘ…" : "PRZENIEŚ"}</button>
            <button onClick={() => setMove(null)} className="btn-ghost !py-3 text-[10px]">ANULUJ</button>
          </div>
        </div>
      )}
    </div>
  );
}