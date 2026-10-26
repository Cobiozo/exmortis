import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import FallbackBadge from "@/components/admin/events/FallbackBadge";
import { Plus, Pencil, Copy, Trash2, Users, Ban, Link2, Repeat, Ticket, ScanLine, X } from "lucide-react";
import EventEditor from "@/components/admin/events/EventEditor";
import ParticipantsPanel from "@/components/admin/events/ParticipantsPanel";
import TicketsPanel from "@/components/admin/tickets/TicketsPanel";
import ScannersPanel from "@/components/admin/tickets/ScannersPanel";
import { whenText } from "@/components/exmortis/events/time";
import { SITE_URL } from "@/config/site";

const STATUS_STYLE = {
  Opublikowane: "text-[#C9A24A]",
  Szkic: "text-foreground/40",
  Odwołane: "blood-text",
};

const TABS = [
  { key: "nadchodzace", label: "Nadchodzące" },
  { key: "szkice", label: "Szkice" },
  { key: "zakonczone", label: "Zakończone" },
  { key: "odwolane", label: "Odwołane" },
];

// Zakładka SPOTKANIA: lista wydarzeń w zakładkach, edycja, uczestnicy,
// duplikacja, odwołanie, kopiowanie linku i powtarzanie Wieczorów powrotu.
export default function EventsManager() {
  const [events, setEvents] = useState(null);
  const [tab, setTab] = useState("nadchodzace");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("wszystkie");
  const [editor, setEditor] = useState(null); // null | {} (nowe) | event
  const [participants, setParticipants] = useState(null); // event | null
  const [tickets, setTickets] = useState(null); // { event, tab } | null
  const [scanners, setScanners] = useState(false);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState("");

  const load = () =>
    base44.functions
      .invoke("eventsAdmin", { action: "list" })
      .then((res) => setEvents(res.data.events))
      .catch(() => setEvents([]));

  useEffect(() => {
    load();
  }, []);

  const ended = (ev) => {
    if (!ev.start_datetime) return false;
    const end = new Date(new Date(ev.start_datetime).getTime() + (Number(ev.duration_minutes) || 60) * 60000);
    return end < new Date();
  };

  const inTab = (ev) => {
    if (tab === "odwolane") return ev.status === "Odwołane";
    if (ev.status === "Odwołane") return false;
    if (tab === "szkice") return ev.status === "Szkic";
    if (tab === "zakonczone") return ev.status === "Opublikowane" && ended(ev);
    return ev.status === "Opublikowane" && !ended(ev); // nadchodzące
  };

  const types = useMemo(() => [...new Set((events || []).map((e) => e.event_type))], [events]);

  const filtered = useMemo(() => {
    return (events || [])
      .filter(inTab)
      .filter((ev) => typeFilter === "wszystkie" || ev.event_type === typeFilter)
      .filter(
        (ev) =>
          !query ||
          ev.title.toLowerCase().includes(query.toLowerCase()) ||
          (ev.slug || "").toLowerCase().includes(query.toLowerCase())
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, tab, query, typeFilter]);

  const run = async (fn) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const duplicate = (id) =>
    run(async () => {
      await base44.functions.invoke("eventsAdmin", { action: "duplicate", id });
      await load();
    });

  const remove = (id) =>
    run(async () => {
      if (!window.confirm("Usunąć szkic wydarzenia? Tej operacji nie da się cofnąć.")) return;
      try {
        await base44.functions.invoke("eventsAdmin", { action: "delete", id });
      } catch (err) {
        setInfo(err?.response?.data?.error || "Nie udało się usunąć.");
        return;
      }
      await load();
    });

  const cancelEvent = (ev) =>
    run(async () => {
      const reason = window.prompt(`Odwołać «${ev.title}»? Podaj powód, który dostaną zapisani:`);
      if (reason === null) return;
      const res = await base44.functions.invoke("eventsAdmin", {
        action: "cancel",
        id: ev.id,
        reason,
      });
      setInfo(
        res.data.notified > 0
          ? `Wydarzenie odwołane. Wiadomość poszła do ${res.data.notified} zapisanych.`
          : "Wydarzenie odwołane."
      );
      await load();
    });

  const copyLink = (ev) =>
    run(async () => {
      const url = `${SITE_URL}/spotkania/${ev.slug}`;
      try {
        await navigator.clipboard.writeText(url);
        setInfo(`Skopiowano link: ${url}`);
      } catch {
        setInfo(url);
      }
    });

  const repeat = (ev) =>
    run(async () => {
      const months = Number(window.prompt("Ile miesięcy naprzód utworzyć szkice? (pierwszy czwartek miesiąca, 20:00)", "6") || 0);
      if (!months || months < 1) return;
      const res = await base44.functions.invoke("eventsAdmin", { action: "repeat", id: ev.id, months });
      setInfo(`Utworzono ${res.data.created.length} szkiców na kolejne miesiące.`);
      await load();
    });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <p className="technical text-[10px] gold-text mb-2">MODUŁ SPOTKAŃ</p>
          <h2 className="relic-heading text-2xl">Wydarzenia i zapisy</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setScanners(true)} className="btn-ghost !px-4 !py-3" title="Kto może sprawdzać bilety skanerem">
            <ScanLine className="h-4 w-4" /> SKANOWANIE BILETÓW
          </button>
          <button onClick={() => setEditor({})} className="btn-relic !px-5 !py-3">
            <Plus className="h-4 w-4" /> NOWE WYDARZENIE
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`technical text-[10px] px-4 py-2 border transition-colors ${
              tab === t.key ? "border-[#C9A24A] gold-text" : "hairline text-foreground/40 hover:text-foreground"
            }`}
          >
            {t.label.toUpperCase()}
          </button>
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Szukaj po tytule lub slugu…"
          className="bg-transparent border hairline px-4 py-2 text-foreground text-sm placeholder:text-foreground/30 focus:border-[#C9A24A] focus:outline-none min-w-[220px]"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-[#0D0D0E] border hairline px-3 py-2 text-foreground/70 text-sm focus:border-[#C9A24A] focus:outline-none"
        >
          <option value="wszystkie">Wszystkie typy</option>
          {types.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {info && <p className="technical text-[10px] gold-text mb-4">{info}</p>}

      {!events ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 border hairline bg-[#0D0D0E] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-foreground/50 border hairline p-8 text-center">
          Brak wydarzeń w tej zakładce.
        </p>
      ) : (
        <div className="border hairline divide-y hairline">
          {filtered.map((ev) => (
            <div key={ev.id} className="flex flex-col lg:flex-row lg:items-center gap-4 p-5">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="technical text-[9px] text-foreground/40 border hairline px-2 py-0.5">
                    {ev.event_type.toUpperCase()}
                  </span>
                  <span className={`technical text-[9px] ${STATUS_STYLE[ev.status] || ""}`}>
                    {ev.status.toUpperCase()}
                  </span>
                </div>
                <p className="shop-heading text-lg text-[#F5EFE1] mt-2 truncate">{ev.title}</p>
                <FallbackBadge ev={ev} />
                <p className="text-xs text-foreground/40 mt-1">
                  {ev.start_datetime ? whenText(ev.start_datetime) : "bez daty — ustaw przed publikacją"}
                </p>
              </div>

              <div className="technical text-[10px] text-foreground/50 lg:text-right whitespace-nowrap">
                {ev.tickets ? <>BILETY <span className="gold-text">{ev.tickets_sold || 0}</span>{ev.capacity ? ` / ${ev.capacity}` : ""} · WESZŁO <span className="gold-text">{ev.tickets_checked || 0}</span><br /></> : null}
                ZAPISANI <span className="gold-text">{ev.registered}</span>
                {ev.capacity ? ` / ${ev.capacity}` : ""}
                {ev.waitlist > 0 && <> · REZERWA <span className="gold-text">{ev.waitlist}</span></>}
              </div>

              <div className="flex flex-wrap gap-2">
                <button onClick={() => setEditor(ev)} className="btn-ghost !px-3 !py-2" title="Edytuj">
                  <Pencil className="h-3.5 w-3.5" /> EDYTUJ
                </button>
                <button onClick={() => setParticipants(ev)} className="btn-ghost !px-3 !py-2" title="Uczestnicy">
                  <Users className="h-3.5 w-3.5" /> UCZESTNICY
                </button>
                {(ev.tickets || ev.tickets_sold > 0) && (
                  <button onClick={() => setTickets({ event: ev, tab: "bilety" })} className="btn-ghost !px-3 !py-2" title="Bilety: lista, wzór PDF, udostępnianie, skanowanie">
                    <Ticket className="h-3.5 w-3.5" /> BILETY
                  </button>
                )}
                <button
                  onClick={() => duplicate(ev.id)}
                  disabled={busy}
                  className="btn-ghost !px-3 !py-2 disabled:opacity-50"
                  title="Duplikuj (spotkania cykliczne)"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => cancelEvent(ev)}
                  disabled={busy || ev.status === "Odwołane"}
                  className="btn-ghost !px-3 !py-2 disabled:opacity-50 hover:!border-[#BC1E22] hover:!text-[#BC1E22]"
                  title="Odwołaj (z powodem i e-mailem do zapisanych)"
                >
                  <Ban className="h-3.5 w-3.5" />
                </button>
                {ev.event_type === "Wieczór powrotu" && (
                  <button
                    onClick={() => repeat(ev)}
                    disabled={busy}
                    className="btn-ghost !px-3 !py-2 disabled:opacity-50"
                    title="Powtarzaj: pierwszy czwartek miesiąca, 20:00"
                  >
                    <Repeat className="h-3.5 w-3.5" />
                  </button>
                )}
                {ev.slug && (
                  <button
                    onClick={() => copyLink(ev)}
                    className="btn-ghost !px-3 !py-2"
                    title="Kopiuj link do strony spotkania"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                  </button>
                )}
                {ev.status === "Szkic" && (
                  <button
                    onClick={() => remove(ev.id)}
                    disabled={busy}
                    className="btn-ghost !px-3 !py-2 disabled:opacity-50 hover:!border-[#BC1E22] hover:!text-[#BC1E22]"
                    title="Usuń (tylko szkice)"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editor && (
        <EventEditor
          event={editor.id ? editor : null}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            load();
          }}
        />
      )}
      {participants && (
        <ParticipantsPanel event={participants} onClose={() => setParticipants(null)} />
      )}
      {tickets && <TicketsPanel event={tickets.event} initialTab={tickets.tab} onClose={() => { setTickets(null); load(); }} />}
      {scanners && (
        <div className="fixed inset-0 z-50 bg-[#0A0A0B] overflow-y-auto" role="dialog" aria-modal="true" aria-label="Skanowanie biletów">
          <div className="sticky top-0 bg-[#0A0A0B]/95 border-b hairline px-4 sm:px-8 py-4 flex items-center gap-4">
            <h2 className="shop-heading text-xl text-[#F5EFE1] flex-1">Skanowanie biletów — uprawnienia</h2>
            <button type="button" onClick={() => setScanners(false)} className="h-11 w-11 flex items-center justify-center text-foreground/60 hover:text-foreground" aria-label="Zamknij"><X className="h-5 w-5" /></button>
          </div>
          <div className="mx-auto max-w-[1200px] px-4 sm:px-8 py-8"><ScannersPanel event={null} /></div>
        </div>
      )}
    </div>
  );
}