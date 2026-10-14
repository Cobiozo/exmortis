import React, { useMemo, useState } from "react";
import { Download, Send, Ban, RotateCcw, Check, Plus, FileDown } from "lucide-react";
import { base44 } from "@/api/base44Client";

const STATUS = { wazny: ["WAŻNY", "gold-text"], wykorzystany: ["WSZEDŁ / WESZŁA", "text-[#8FBF7F]"], anulowany: ["ANULOWANY", "text-[#E8676A]"] };
const hhmm = (iso) => (iso ? new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "");
const inp = "bg-transparent border hairline px-3 py-2.5 text-sm focus:border-[#C9A24A] focus:outline-none";

// Sprzedane bilety: wyszukiwanie, obecność, ponowna wysyłka, anulowanie, bilet ręczny, CSV.
export default function TicketsList({ event, tickets, reload }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [add, setAdd] = useState({ name: "", email: "", send: true });
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return !s ? tickets : tickets.filter((t) => [t.code, t.holder_name, t.buyer_email].some((v) => String(v || "").toLowerCase().includes(s)));
  }, [tickets, q]);

  const run = async (key, payload, ok) => {
    if (busy) return;
    setBusy(key); setMsg("");
    try {
      const r = await base44.functions.invoke("ticketsAdmin", payload);
      if (r.data?.error) throw new Error(r.data.error);
      setMsg(ok(r.data));
      await reload();
    } catch (e) { setMsg(e?.response?.data?.error || e.message || "Nie udało się."); }
    setBusy("");
  };

  const csv = () => {
    const rows = [["numer", "imię i nazwisko", "e-mail kupującego", "cena", "źródło", "status", "wejście", "sprawdził(a)"],
      ...tickets.map((t) => [t.code, t.holder_name, t.buyer_email || "", t.price, t.source, t.status, t.checked_at || "", t.checked_by || ""])];
    const text = "﻿" + rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    a.download = `bilety-${event.slug || event.id}.csv`;
    a.click();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-3 items-center">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj: numer, imię, e-mail" aria-label="Szukaj biletu" className={`${inp} flex-1 min-w-[220px]`} />
        <button type="button" onClick={csv} disabled={!tickets.length} className="btn-ghost !px-4 !py-2.5 disabled:opacity-40"><FileDown className="h-4 w-4" /> CSV</button>
      </div>
      {msg && <p className="technical text-[10px] gold-text" role="status">{msg}</p>}

      {!list.length ? (
        <p className="text-foreground/55 border hairline p-8 text-center">{tickets.length ? "Nic nie pasuje do wyszukiwania." : "Nie sprzedano jeszcze żadnego biletu."}</p>
      ) : (
        <div className="border hairline divide-y hairline">
          {list.map((t) => (
            <div key={t.id} className="p-4 grid gap-3 md:grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
              <span className="font-mono gold-text">{t.code}</span>
              <div className="min-w-0">
                <p className="text-[#F5EFE1] break-words">{t.holder_name}</p>
                <p className="text-xs text-foreground/45 break-all">{t.buyer_email || "bez e-maila"} · {t.source === "recznie" ? "dodany ręcznie" : `${Number(t.price)} zł`}</p>
              </div>
              <div className="text-xs">
                <span className={`technical text-[9px] ${STATUS[t.status]?.[1] || ""}`}>{STATUS[t.status]?.[0] || t.status}</span>
                {t.checked_at && <span className="text-foreground/45"> · {hhmm(t.checked_at)}{t.checked_by ? ` · ${t.checked_by}` : ""}</span>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {t.status !== "anulowany" && (
                  <button type="button" disabled={!!busy} title={t.status === "wykorzystany" ? "Cofnij wejście" : "Oznacz wejście"}
                    onClick={() => run(`c${t.id}`, { action: "checkin", ticket_id: t.id, undo: t.status === "wykorzystany" }, (d) => (d.result === "ok" ? `Wejście: ${t.code}` : d.result === "cofniety" ? `Cofnięto wejście ${t.code}` : `Bez zmian (${d.result})`))}
                    className="btn-ghost !px-2.5 !py-2 disabled:opacity-40" aria-label={t.status === "wykorzystany" ? `Cofnij wejście ${t.code}` : `Oznacz wejście ${t.code}`}>
                    {t.status === "wykorzystany" ? <RotateCcw className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                  </button>
                )}
                <a href={t.pdf} className="btn-ghost !px-2.5 !py-2" title="PDF biletu" aria-label={`PDF biletu ${t.code}`}><Download className="h-3.5 w-3.5" /></a>
                <button type="button" disabled={!!busy || t.status === "anulowany"} title="Wyślij bilet ponownie"
                  onClick={() => { const to = window.prompt("Wysłać bilet na adres:", t.buyer_email || ""); if (to) run(`s${t.id}`, { action: "resend", ticket_id: t.id, email: to }, (d) => `Wysłano na ${d.to}`); }}
                  className="btn-ghost !px-2.5 !py-2 disabled:opacity-40" aria-label={`Wyślij ponownie ${t.code}`}><Send className="h-3.5 w-3.5" /></button>
                <button type="button" disabled={!!busy}
                  onClick={() => (t.status === "anulowany" || window.confirm(`Anulować bilet ${t.code} (${t.holder_name})? Nie przejdzie przez skaner. Zwrot pieniędzy robisz osobno w PayU.`))
                    && run(`x${t.id}`, { action: t.status === "anulowany" ? "restore" : "cancel", ticket_id: t.id }, () => (t.status === "anulowany" ? `Przywrócono ${t.code}` : `Anulowano ${t.code}`))}
                  className="btn-ghost !px-2.5 !py-2 disabled:opacity-40 hover:!border-[#BC1E22]" title={t.status === "anulowany" ? "Przywróć" : "Anuluj bilet"}
                  aria-label={t.status === "anulowany" ? `Przywróć ${t.code}` : `Anuluj ${t.code}`}>{t.status === "anulowany" ? <RotateCcw className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <form className="border hairline p-5 space-y-4" onSubmit={(e) => { e.preventDefault(); run("add", { action: "add", event_id: event.id, ...add }, (d) => `Dodano bilet ${d.code}${d.mailed ? " i wysłano e-mail" : ""}`).then(() => setAdd({ name: "", email: "", send: true })); }}>
        <p className="technical text-[10px] gold-text">DODAJ BILET RĘCZNIE (GOŚĆ, ZAPROSZENIE, PŁATNOŚĆ POZA STRONĄ)</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <input required minLength={3} value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} placeholder="Imię i nazwisko" aria-label="Imię i nazwisko" className={inp} />
          <input type="email" value={add.email} onChange={(e) => setAdd({ ...add, email: e.target.value })} placeholder="E-mail (nieobowiązkowo)" aria-label="E-mail" className={inp} />
        </div>
        <label className="flex items-center gap-3 text-sm text-foreground/70"><input type="checkbox" checked={add.send} disabled={!add.email} onChange={(e) => setAdd({ ...add, send: e.target.checked })} className="h-5 w-5 accent-[#C9A24A]" /> Wyślij bilet e-mailem</label>
        <button type="submit" disabled={!!busy} className="btn-relic !px-5 !py-3 disabled:opacity-50"><Plus className="h-4 w-4" /> DODAJ BILET</button>
        <p className="text-xs text-foreground/45">Bilet ręczny ma cenę 0 zł i liczy się do limitu miejsc.</p>
      </form>
    </div>
  );
}
