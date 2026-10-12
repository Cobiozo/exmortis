import React, { useEffect, useState } from "react";
import { Loader2, ArrowUp, ArrowDown, CalendarClock } from "lucide-react";
import { rz, fmtWhen, isScheduled } from "./rzApi";
import { warsawLocalToIso } from "@/lib/warsawTime";

const inp = "bg-[#0A0A0B] border hairline px-3 py-2.5 text-sm text-foreground focus:border-[#C9A24A] focus:outline-none";
const lab = "technical text-[10px] text-foreground/55 block mb-1.5";

const plural = (n) => (n === 1 ? "historię" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "historie" : "historii");

// Te same daty co na serwerze: kolejne co N dni o tej samej godzinie czasu polskiego.
function addDaysLocal(local, days) {
  const [d, t] = local.split("T");
  const [y, m, dd] = d.split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1, dd + days));
  return `${x.toISOString().slice(0, 10)}T${t}`;
}

// Harmonogram: zaznaczone historie w wybranej kolejności, pierwsza w podanym terminie, kolejne co tydzień (lub co N dni).
// Szkice bez błędów zostają opublikowane jako ukryte do swojej daty; nic nie pojawia się przed czasem.
export default function SchedulePlan({ items, onDone }) {
  const [order, setOrder] = useState([]);
  const [on, setOn] = useState({});
  const [start, setStart] = useState("");
  const [every, setEvery] = useState(7);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");

  // Domyślnie: kolejność z biblioteki; zaznaczone historie, których klienci jeszcze nie widzą
  // (gdy żadna nie ma jeszcze terminu — wszystkie).
  useEffect(() => {
    if (!items) return;
    const none = !items.some((s) => s.visible_from);
    setOrder((o) => { const ids = items.map((s) => s.id); return [...o.filter((id) => ids.includes(id)), ...ids.filter((id) => !o.includes(id))]; });
    setOn((o) => Object.fromEntries(items.map((s) => [s.id, o[s.id] ?? (none || s.status !== "published" || isScheduled(s))])));
  }, [items]);
  if (!items?.length) return null;

  const byId = new Map(items.map((s) => [s.id, s]));
  const chosen = order.filter((id) => on[id] && byId.has(id));
  const move = (i, d) => setOrder((o) => { const n = [...o]; const j = i + d; if (j < 0 || j >= n.length) return o; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const dateOf = (id) => { const k = chosen.indexOf(id); return k < 0 || !start ? null : warsawLocalToIso(addDaysLocal(start, every * k)); };
  const valid = start && chosen.length && every >= 1 && every <= 90;
  const past = start && Date.parse(warsawLocalToIso(start)) < Date.now();

  const apply = async () => {
    setBusy(true); setErr(""); setRes(null); setConfirm(false);
    try { const r = await rz("schedule_plan", { ids: chosen, start: warsawLocalToIso(start), every_days: every }); setRes(r.results); await onDone?.(); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <details className="border hairline p-5 md:p-6" open={items.some(isScheduled)}>
      <summary className="cursor-pointer shop-heading text-xl text-[#F5EFE1]">Harmonogram publikacji</summary>
      <div className="mt-5 space-y-5">
        <p className="text-sm text-foreground/60 max-w-3xl leading-relaxed">
          Zaznacz historie i ustaw ich kolejność. Pierwsza pojawi się w podanym terminie, każda następna po wybranej liczbie dni, o tej samej godzinie.
          Do tego czasu klienci jej nie widzą. Szkice bez błędów zostaną opublikowane jako ukryte do swojej daty.
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <label className="block"><span className={lab}>PIERWSZA HISTORIA (CZAS POLSKI)</span>
            <input type="datetime-local" className={inp} value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label className="block"><span className={lab}>KOLEJNE CO (DNI)</span>
            <input type="number" min="1" max="90" className={`${inp} w-24`} value={every} onChange={(e) => setEvery(Math.max(1, Math.min(90, Number(e.target.value) || 7)))} /></label>
        </div>
        {past && <p className="text-xs text-[#E8C547]">Pierwszy termin jest w przeszłości — ta historia będzie widoczna od razu.</p>}
        <ol className="border hairline divide-y divide-[#2A2A2D]">
          {order.filter((id) => byId.has(id)).map((id, i) => {
            const s = byId.get(id); const when = dateOf(id);
            return (
              <li key={id} className="flex items-center gap-3 p-3">
                <input type="checkbox" className="h-4 w-4 accent-[#C9A24A] shrink-0" checked={!!on[id]} onChange={(e) => setOn({ ...on, [id]: e.target.checked })} aria-label={`Uwzględnij: ${s.title}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[#F5EFE1] truncate">{s.title}</p>
                  <p className="text-xs text-foreground/50 truncate">
                    {when ? <span className="gold-text">{fmtWhen(when)}</span> : on[id] ? "ustaw pierwszy termin" : "bez zmian"}
                    {s.visible_from && <span> · teraz: {isScheduled(s) ? `zaplanowana ${fmtWhen(s.visible_from)}` : s.status === "published" ? "widoczna" : `termin ${fmtWhen(s.visible_from)}`}</span>}
                    {!s.visible_from && s.status === "published" && <span> · teraz: widoczna</span>}
                    {s.status !== "published" && <span> · szkic</span>}
                  </p>
                </div>
                <button type="button" className="p-2 text-foreground/50 hover:text-[#C9A24A] disabled:opacity-30" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Wyżej"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" className="p-2 text-foreground/50 hover:text-[#C9A24A] disabled:opacity-30" onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label="Niżej"><ArrowDown className="h-4 w-4" /></button>
              </li>
            );
          })}
        </ol>
        {!confirm ? (
          <button type="button" className="btn-relic !px-4 !py-2 text-[10px] disabled:opacity-40" disabled={!valid || busy} onClick={() => setConfirm(true)}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />} ZAPLANUJ ({chosen.length})
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2 border border-[#E8C547]/60 p-3">
            <span className="text-sm text-[#E8C547]">Zaplanować {chosen.length} {plural(chosen.length)}? Historie widoczne teraz znikną z biblioteki do swojej daty.</span>
            <button type="button" className="btn-relic !px-3 !py-1.5 text-[10px]" onClick={apply}>TAK, ZAPLANUJ</button>
            <button type="button" className="btn-ghost !px-3 !py-1.5 text-[10px]" onClick={() => setConfirm(false)}>ANULUJ</button>
          </div>
        )}
        {err && <p className="text-sm text-[#E8676A]" role="alert">{err}</p>}
        {res && (
          <ul className="text-sm space-y-1" role="status">
            {res.map((r) => <li key={r.id} className={r.skipped ? "text-[#E8676A]" : "text-[#9FD3A0]"}>{r.title}: {r.skipped || fmtWhen(r.visible_from)}</li>)}
          </ul>
        )}
      </div>
    </details>
  );
}
