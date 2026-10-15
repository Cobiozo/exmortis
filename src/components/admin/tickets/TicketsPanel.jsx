import React, { useCallback, useEffect, useState } from "react";
import { X, ScanLine } from "lucide-react";
import { base44 } from "@/api/base44Client";
import TicketsList from "./TicketsList";
import TemplateEditor from "./TemplateEditor";
import SharePanel from "./SharePanel";
import ScannersPanel from "./ScannersPanel";

const TABS = [["bilety", "Sprzedane bilety"], ["wzor", "Wzór biletu"], ["udostepnij", "Udostępnianie"], ["skanowanie", "Skanowanie"]];

// Bilety jednego wydarzenia: lista, wzór PDF, link do udostępnienia, osoby sprawdzające bilety.
export default function TicketsPanel({ event, onClose, initialTab = "bilety" }) {
  const [tab, setTab] = useState(initialTab);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => base44.functions.invoke("ticketsAdmin", { action: "get", event_id: event.id })
    .then((r) => { setData(r.data); setErr(""); })
    .catch((e) => setErr(e?.response?.data?.error || "Nie udało się wczytać biletów.")), [event.id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const k = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);

  const ev = data?.event;
  return (
    <div className="fixed inset-0 z-50 bg-[#0A0A0B] overflow-y-auto overflow-x-hidden" role="dialog" aria-modal="true" aria-labelledby="tk-title">
      <div className="sticky top-0 z-20 bg-[#0A0A0B]/95 border-b hairline px-4 sm:px-8 py-4">
        <div className="mx-auto max-w-[1200px] flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <p className="technical text-[10px] gold-text">BILETY</p>
            <h2 id="tk-title" className="shop-heading text-xl sm:text-2xl text-[#F5EFE1] truncate">{event.title}</h2>
            {data && (
              <p className="text-xs text-foreground/55 mt-1">
                Sprzedane {data.counts.sold}{ev?.capacity ? ` / ${ev.capacity}` : ""} · wpuszczone {data.counts.checked} · cena {Number(ev?.price || 0)} zł
                {!ev?.tickets && <span className="text-[#E8C547]"> · bilety są wyłączone (włącz w edycji spotkania → Miejsce; tylko spotkania stacjonarne)</span>}
              </p>
            )}
          </div>
          <a href="/skaner" target="_blank" rel="noreferrer" className="btn-ghost !px-3 !py-2 hidden sm:inline-flex"><ScanLine className="h-4 w-4" /> SKANER</a>
          <button type="button" onClick={onClose} className="h-11 w-11 flex items-center justify-center text-foreground/60 hover:text-foreground" aria-label="Zamknij"><X className="h-5 w-5" /></button>
        </div>
        <div className="mx-auto max-w-[1200px] flex gap-2 mt-4 overflow-x-auto" role="tablist">
          {TABS.map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`technical text-[10px] px-4 py-2 border whitespace-nowrap ${tab === k ? "border-[#C9A24A] gold-text" : "hairline text-foreground/50 hover:text-foreground"}`}>{l.toUpperCase()}</button>
          ))}
        </div>
      </div>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-8 py-8">
        {err && <p role="alert" className="text-sm text-[#E5484D] mb-6">{err}</p>}
        {!data && !err && <p className="text-foreground/50">Ładowanie…</p>}
        {data && tab === "bilety" && <TicketsList event={ev} tickets={data.tickets} reload={load} />}
        {data && tab === "wzor" && <TemplateEditor event={ev} reload={load} />}
        {data && tab === "udostepnij" && <SharePanel event={ev} />}
        {data && tab === "skanowanie" && <ScannersPanel event={ev} />}
      </div>
    </div>
  );
}
