import React, { useEffect, useState } from "react";
import { Plus, Trash2, ScanLine, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { SITE_URL } from "@/config/site";

const inp = "bg-transparent border hairline px-3 py-2.5 text-sm focus:border-[#C9A24A] focus:outline-none";
const day = (iso) => (iso ? new Date(iso).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" }) : "bez limitu");

// Kto może sprawdzać bilety skanerem (/skaner): e-mail konta, wszystkie wydarzenia albo to jedno, opcjonalnie do daty.
// Administrator może zawsze. Osoba musi mieć konto na exmortis.pl na ten sam adres.
export default function ScannersPanel({ event }) {
  const [list, setList] = useState(null);
  const [add, setAdd] = useState({ email: "", scope: event ? "one" : "all", until: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { base44.functions.invoke("ticketsAdmin", { action: "scanners_get" }).then((r) => setList(r.data.scanners || [])).catch(() => setList([])); }, []);

  const persist = async (next, info) => {
    setBusy(true); setMsg("");
    try {
      const r = await base44.functions.invoke("ticketsAdmin", { action: "scanners_save", scanners: next });
      setList(r.data.scanners);
      setMsg(info);
    } catch (e) { setMsg(e?.response?.data?.error || "Nie udało się zapisać."); }
    setBusy(false);
  };
  const addOne = (e) => {
    e.preventDefault();
    const email = add.email.trim().toLowerCase();
    if (!email) return;
    const until = add.until ? new Date(`${add.until}T23:59:59`).toISOString() : null;
    persist([...list, { email, event_id: add.scope === "one" && event ? event.id : null, until, note: add.note.trim() }],
      `Dodano ${email}. Wyślij tej osobie link: ${SITE_URL}/skaner (logowanie tym adresem).`)
      .then(() => setAdd({ ...add, email: "", note: "" }));
  };

  if (!list) return <p className="text-foreground/50">Ładowanie…</p>;
  const shown = list.filter((s) => !event || !s.event_id || s.event_id === event.id);
  return (
    <div className="space-y-8 max-w-3xl">
      <div className="text-sm text-foreground/65 leading-relaxed space-y-2">
        <p>Skaner działa na telefonie w przeglądarce: <a href="/skaner" target="_blank" rel="noreferrer" className="gold-text underline">{SITE_URL}/skaner</a>. Osoba loguje się swoim kontem, wybiera wydarzenie i skanuje kody QR z biletów — wejście zapisuje się od razu, drugi raz ten sam bilet nie przejdzie.</p>
        <p className="text-foreground/50">Ty jako administrator możesz skanować zawsze. Tutaj dodajesz inne osoby (np. obsługę wejścia) — muszą mieć konto na exmortis.pl na ten sam adres e-mail.</p>
      </div>

      {shown.length ? (
        <ul className="border hairline divide-y hairline">
          {shown.map((s) => (
            <li key={`${s.email}|${s.event_id || ""}`} className="p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <p className="text-[#F5EFE1] break-all">{s.email}</p>
                <p className="text-xs text-foreground/50">{s.event_id ? (event && s.event_id === event.id ? "tylko to wydarzenie" : "jedno wydarzenie") : "wszystkie wydarzenia"} · ważne: {day(s.until)}{s.note ? ` · ${s.note}` : ""}</p>
              </div>
              <button type="button" disabled={busy} onClick={() => window.confirm(`Odebrać uprawnienie ${s.email}?`) && persist(list.filter((x) => x !== s), `Odebrano uprawnienie ${s.email}.`)}
                className="btn-ghost !px-3 !py-2 disabled:opacity-40 hover:!border-[#BC1E22]" aria-label={`Odbierz uprawnienie ${s.email}`}><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      ) : <p className="text-foreground/50 border hairline p-6 text-center">Na razie tylko Ty możesz skanować bilety.</p>}

      <form onSubmit={addOne} className="border hairline p-5 space-y-4">
        <p className="technical text-[10px] gold-text">DODAJ OSOBĘ SPRAWDZAJĄCĄ BILETY</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <input type="email" required value={add.email} onChange={(e) => setAdd({ ...add, email: e.target.value })} placeholder="E-mail konta" aria-label="E-mail konta" className={inp} />
          <input value={add.note} onChange={(e) => setAdd({ ...add, note: e.target.value })} placeholder="Notatka (np. obsługa wejścia)" aria-label="Notatka" className={inp} maxLength={120} />
          {event && (
            <select value={add.scope} onChange={(e) => setAdd({ ...add, scope: e.target.value })} aria-label="Zakres" className={`${inp} bg-[#0D0D0E]`}>
              <option value="one">Tylko to wydarzenie</option>
              <option value="all">Wszystkie wydarzenia</option>
            </select>
          )}
          <label className="text-sm text-foreground/60 flex items-center gap-2">Ważne do <input type="date" value={add.until} onChange={(e) => setAdd({ ...add, until: e.target.value })} className={`${inp} flex-1`} /></label>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={busy} className="btn-relic !px-5 !py-3 disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} DODAJ</button>
          <a href="/skaner" target="_blank" rel="noreferrer" className="btn-ghost !px-4 !py-3"><ScanLine className="h-4 w-4" /> OTWÓRZ SKANER</a>
        </div>
      </form>
      {msg && <p className="technical text-[10px] gold-text break-all" role="status">{msg}</p>}
    </div>
  );
}
