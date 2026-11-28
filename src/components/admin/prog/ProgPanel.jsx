import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { FilterChips } from "@/components/admin/ui/kit";

// Rozmowa na progu — uczestnicy (18.11.2026). Osobna usługa, niezależna od POWRÓT.
// Statusy liczy serwer z zamówienia, pakietu i rezerwacji; tu: przegląd, ankieta, podsumowanie, wiadomość, zamknięcie.
const TABS = [
  ["platnosc", "Czeka na płatność", (r) => r.status === "do_platnosci"],
  ["toku", "Opłacone i zaplanowane", (r) => ["oplacone", "termin_wybrany"].includes(r.status)],
  ["po", "Po spotkaniu", (r) => ["odbyta", "nieobecnosc"].includes(r.status)],
  ["archiwum", "Archiwum", (r) => ["anulowana", "zamkniete"].includes(r.status)],
  ["wszystkie", "Wszystkie", () => true],
];
const SUM = { oczekuje: "Podsumowanie: czeka", przygotowywane: "Podsumowanie: wersja robocza", wyslane: "Podsumowanie: udostępnione", pominiete: "Podsumowanie: pominięte" };
const dt = (v) => (v ? new Date(v).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
const inp = "w-full bg-transparent border hairline px-4 py-3 text-sm focus:outline-none focus:border-[#C9A24A]";
const call = (action, args = {}) => base44.functions.invoke("adminProg", { action, ...args }).then((r) => r.data);

function Card({ id, onChanged }) {
  const [d, setD] = useState(null);
  const [sum, setSum] = useState("");
  const [note, setNote] = useState("");
  const [mail, setMail] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => call("detail", { id }).then((x) => { setD(x); setSum(x.summary?.tresc || ""); setNote(x.app.notatka || ""); });
  useEffect(() => { load().catch((e) => setMsg(e?.response?.data?.error || "Nie udało się wczytać.")); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (action, args, ok) => {
    setBusy(true); setMsg("");
    try { await call(action, { id, ...args }); setMsg(ok); if (action !== "delete") await load(); onChanged(); return true; }
    catch (e) { setMsg(e?.response?.data?.error || "Nie udało się."); return false; }
    finally { setBusy(false); }
  };
  if (!d) return <p className="text-sm text-foreground/50 p-4">{msg || "Wczytuję…"}</p>;
  const { app } = d;
  const canSummary = ["oplacone", "termin_wybrany", "odbyta", "nieobecnosc"].includes(app.status);
  return (
    <div className="border-t hairline p-4 md:p-6 space-y-6 bg-[#111113]">
      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        <p><span className="text-foreground/50">E-mail:</span> {app.email}</p>
        <p><span className="text-foreground/50">Telefon:</span> {app.phone || "—"}</p>
        <p><span className="text-foreground/50">Termin:</span> {d.booking ? `${dt(d.booking.starts_at)} (${d.booking.status})` : "—"}</p>
        <p><span className="text-foreground/50">Zamówienie:</span> {app.order_id ? app.order_id.slice(0, 8) : "—"}</p>
      </div>
      <div className="space-y-3">
        <p className="technical text-[10px] gold-text">ANKIETA PRZED SPOTKANIEM</p>
        {d.pytania.map((q) => (
          <div key={q.key}>
            <p className="text-xs text-foreground/50">{q.label}</p>
            <p className="text-sm whitespace-pre-wrap">{app.ankieta?.[q.key] || "—"}</p>
          </div>
        ))}
        <p className="text-xs text-foreground/50">Pisemne podsumowanie: {app.podsumowanie_chce ? "tak, uczestnik chce" : "nie"}</p>
      </div>

      <div className="space-y-2">
        <p className="technical text-[10px] gold-text">PODSUMOWANIE DLA UCZESTNIKA</p>
        <p className="text-xs text-foreground/55">{d.summary ? SUM[d.summary.status] : "Pojawi się po spotkaniu (gdy uczestnik chce podsumowania)."}{d.summary?.shared_at ? ` · udostępnione ${dt(d.summary.shared_at)}` : ""}{d.summary?.read_at ? ` · przeczytane ${dt(d.summary.read_at)}` : ""}</p>
        <textarea rows={10} className={inp} value={sum} onChange={(e) => setSum(e.target.value)} disabled={!canSummary}
          placeholder="Najważniejsze spostrzeżenia, rozważane możliwości, pytania otwarte, ewentualny następny krok." />
        <div className="flex flex-wrap gap-3">
          <button disabled={busy || !canSummary || !sum.trim()} onClick={() => act("summary_save", { tresc: sum }, "Zapisano wersję roboczą.")} className="btn-ghost disabled:opacity-50">Zapisz roboczo</button>
          <button disabled={busy || !canSummary || !sum.trim()} onClick={() => { if (window.confirm("Udostępnić podsumowanie w koncie uczestnika i wysłać powiadomienie e-mail?")) act("summary_share", { tresc: sum }, "Udostępniono i wysłano powiadomienie."); }} className="btn-relic disabled:opacity-50">Udostępnij uczestnikowi</button>
          {d.summary && d.summary.status !== "wyslane" && <button disabled={busy} onClick={() => act("summary_skip", {}, "Oznaczono jako pominięte.")} className="text-sm text-foreground/50 underline">Pomiń</button>}
        </div>
        <p className="text-[11px] text-foreground/45">Uczestnik otrzymuje e-mail bez treści podsumowania — samą treść widzi po zalogowaniu.</p>
      </div>

      <div className="space-y-2">
        <p className="technical text-[10px] gold-text">WIADOMOŚĆ E-MAIL DO UCZESTNIKA</p>
        <textarea rows={4} className={inp} value={mail} onChange={(e) => setMail(e.target.value)} placeholder="Treść wiadomości (powitanie i podpis dodaję automatycznie)." />
        <button disabled={busy || !mail.trim()} onClick={async () => { if (window.confirm(`Wysłać wiadomość do ${app.email}?`) && (await act("mail", { tresc: mail }, "Wiadomość wysłana."))) setMail(""); }} className="btn-ghost disabled:opacity-50">Wyślij wiadomość</button>
      </div>

      <div className="space-y-2">
        <p className="technical text-[10px] gold-text">NOTATKA (TYLKO DLA CIEBIE)</p>
        <textarea rows={3} className={inp} value={note} onChange={(e) => setNote(e.target.value)} />
        <button disabled={busy} onClick={() => act("note", { notatka: note }, "Notatka zapisana.")} className="btn-ghost">Zapisz notatkę</button>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-foreground/60">Historia ({d.log.length})</summary>
        <ul className="mt-3 space-y-1 text-xs text-foreground/60">
          {d.log.map((l, i) => <li key={i}>{dt(l.at)} · {l.summary} <span className="text-foreground/40">({l.actor})</span></li>)}
        </ul>
      </details>

      <div className="flex flex-wrap gap-4 border-t hairline pt-4">
        {app.status !== "zamkniete" && (
          <button disabled={busy} className="text-sm underline text-foreground/60" onClick={() => {
            const why = window.prompt("Zamknąć zgłoszenie? Link do płatności przestanie działać. Powód (opcjonalnie):", "");
            if (why !== null) act("close", { why }, "Zgłoszenie zamknięte.");
          }}>Zamknij zgłoszenie</button>
        )}
        <button disabled={busy} className="text-sm underline text-[#BC1E22]" onClick={() => {
          const c = window.prompt("Trwałe usunięcie zgłoszenia, ankiety, historii i podsumowania. Nie można tego cofnąć. Zamówienie i rezerwacja zostają. Wpisz USUŃ, aby potwierdzić.");
          if (c === "USUŃ") act("delete", { confirm: "USUŃ" }, "Usunięto.");
        }}>Usuń trwale</button>
      </div>
      {["oplacone", "termin_wybrany"].includes(app.status) && <p className="text-xs text-foreground/50">Odwołanie spotkania ze zwrotem: Rezerwacje (termin) i Zamówienia (zwrot).</p>}
      {msg && <p className="text-sm gold-text" role="status">{msg}</p>}
    </div>
  );
}

export default function ProgPanel() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("toku");
  const [openId, setOpenId] = useState(null);
  const load = () => call("list").then((x) => { setData(x); setErr(""); }).catch((e) => { setErr(e?.response?.data?.error || "Nie udało się wczytać."); setData({ rows: [], stats: null, labels: {} }); });
  useEffect(() => { load(); }, []);
  if (!data) return <p className="text-sm text-foreground/50">Wczytuję…</p>;
  const filter = TABS.find((t) => t[0] === tab)[2];
  const rows = data.rows.filter(filter);
  const s = data.stats || {};
  return (
    <div className="space-y-6">
      <p className="text-sm text-foreground/60 max-w-3xl">Zgłoszenie z ankietą → płatność 799 zł → wybór terminu → spotkanie → podsumowanie. Usługa niezależna od programu POWRÓT. Statusy aktualizują się z zamówień i rezerwacji.</p>
      {err && <p className="text-sm blood-text">{err}</p>}
      <div className="flex flex-wrap gap-3">
        {[["Wszystkie", s.wszystkie], ["Czeka na płatność", s.do_platnosci], ["W toku", s.w_toku], ["Odbyte", s.odbyte], ["Podsumowania do zrobienia", s.podsumowania]].map(([l, v]) => (
          <div key={l} className="border hairline rounded-xl px-4 py-3 min-w-[120px]"><p className="technical text-[9px] text-foreground/45">{l.toUpperCase()}</p><p className="text-xl text-[#F5EFE1] mt-1">{v ?? 0}</p></div>
        ))}
      </div>
      <FilterChips items={TABS.map(([k, l, fn]) => [k, l, data.rows.filter(fn).length])} value={tab} onChange={setTab} label="Etap" />
      <div className="border hairline">
        {rows.length === 0 && <p className="text-sm text-foreground/55 px-6 py-10 text-center">Brak zgłoszeń w tej zakładce.</p>}
        {rows.map((r) => (
          <div key={r.id} className="border-b hairline last:border-b-0">
            <button onClick={() => setOpenId(openId === r.id ? null : r.id)} className="w-full text-left p-4 grid sm:grid-cols-4 gap-2 hover:bg-white/5">
              <span className="text-sm">{r.full_name}<span className="block text-xs text-foreground/45">{dt(r.created_date)}</span></span>
              <span className="text-sm gold-text">{data.labels[r.status] || r.status}</span>
              <span className="text-xs text-foreground/60">{r.termin ? `Termin: ${dt(r.termin)}` : ""}</span>
              <span className="text-xs text-foreground/60">{r.podsumowanie ? SUM[r.podsumowanie] : ""}</span>
            </button>
            {openId === r.id && <Card id={r.id} onChanged={load} />}
          </div>
        ))}
      </div>
    </div>
  );
}
