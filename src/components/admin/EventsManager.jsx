import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Pencil, Copy, Trash2, Users } from "lucide-react";
import EventEditor from "@/components/admin/events/EventEditor";
import ParticipantsPanel from "@/components/admin/events/ParticipantsPanel";
import { whenText } from "@/components/exmortis/events/time";

const STATUS_STYLE = {
  Opublikowane: "text-[#C9A24A]",
  Szkic: "text-foreground/40",
  Odwołane: "blood-text",
};

// Zakładka SPOTKANIA: lista wydarzeń z licznikami, edycja, uczestnicy, duplikacja.
export default function EventsManager() {
  const [events, setEvents] = useState(null);
  const [editor, setEditor] = useState(null); // null | {} (nowe) | event
  const [participants, setParticipants] = useState(null); // event | null
  const [busy, setBusy] = useState(false);

  const load = () =>
    base44.functions
      .invoke("eventsAdmin", { action: "list" })
      .then((res) => setEvents(res.data.events))
      .catch(() => setEvents([]));

  useEffect(() => {
    load();
  }, []);

  const duplicate = async (id) => {
    if (busy) return;
    setBusy(true);
    try {
      await base44.functions.invoke("eventsAdmin", { action: "duplicate", id });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (busy) return;
    if (!window.confirm("Usunąć wydarzenie razem ze zapisami? Tej operacji nie da się cofnąć.")) return;
    setBusy(true);
    try {
      await base44.functions.invoke("eventsAdmin", { action: "delete", id });
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <p className="technical text-[10px] gold-text mb-2">MODUŁ SPOTKAŃ</p>
          <h2 className="relic-heading text-2xl">Wydarzenia i zapisy</h2>
        </div>
        <button onClick={() => setEditor({})} className="btn-relic !px-5 !py-3">
          <Plus className="h-4 w-4" /> NOWE WYDARZENIE
        </button>
      </div>

      {!events ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 border hairline bg-[#0D0D0E] animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="text-foreground/50 border hairline p-8 text-center">
          Brak wydarzeń. Kliknij „Nowe wydarzenie”, żeby dodać pierwsze.
        </p>
      ) : (
        <div className="border hairline divide-y hairline">
          {events.map((ev) => (
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
                <p className="text-xs text-foreground/40 mt-1">
                  {ev.start_datetime ? whenText(ev.start_datetime) : "bez daty — ustaw przed publikacją"}
                </p>
              </div>

              <div className="technical text-[10px] text-foreground/50 lg:text-right whitespace-nowrap">
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
                <button
                  onClick={() => duplicate(ev.id)}
                  disabled={busy}
                  className="btn-ghost !px-3 !py-2 disabled:opacity-50"
                  title="Duplikuj (spotkania cykliczne)"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => remove(ev.id)}
                  disabled={busy}
                  className="btn-ghost !px-3 !py-2 disabled:opacity-50 hover:!border-[#BC1E22] hover:!text-[#BC1E22]"
                  title="Usuń"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
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
    </div>
  );
}