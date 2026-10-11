import React, { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { bk, plDateTime } from "./api";
import UnavailableButton from "./UnavailableButton";

const AKCJA = {
  rezerwacja: "nowa rezerwacja",
  rezerwacja_z_pakietu: "rezerwacja z pakietu",
  przeniesienie: "przeniesienie",
  anulowanie_klient: "anulowanie przez klienta",
  anulowanie_admin: "anulowanie przez admina",
  status_po_spotkaniu: "status po spotkaniu",
  sesja_oddana: "sesja oddana do pakietu",
};

// MUSI 14 i 16: „Dziś i jutro”, przypomnienie o nieoznaczonych spotkaniach, ostatnie zdarzenia.
export default function BookingDashboard({ onGo }) {
  const [d, setD] = useState(null);
  const load = () => bk("dashboard").then(setD).catch(() => setD({ bookings: [], events: [], blocks: [], unmarked: 0, log: [] }));
  useEffect(() => { load(); }, []);

  if (!d) return <p className="text-sm text-foreground/50">Ładowanie…</p>;
  const items = [
    ...d.bookings.map((b) => ({ id: b.id, at: b.starts_at, kind: "rez", title: b.type, who: b.first_name, status: b.status })),
    ...d.events.map((e) => ({ id: e.id, at: e.starts_at, kind: "grupa", title: e.title, who: "spotkanie grupowe" })),
    ...d.blocks.map((x) => ({ id: x.id, at: x.starts_at, kind: "blok", title: x.note || "Zajęte", who: "" })),
  ].sort((a, b) => new Date(a.at) - new Date(b.at));

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="technical text-[10px] gold-text">PULPIT</p>
        <UnavailableButton onDone={load} />
      </div>

      {d.unmarked > 0 && (
        <div className="border border-[#BC1E22] p-4 flex flex-wrap items-center gap-4">
          <AlertTriangle className="h-5 w-5 blood-text" />
          <p className="text-sm flex-1">
            {d.unmarked} {d.unmarked === 1 ? "spotkanie czeka" : "spotkania czekają"} na oznaczenie (odbyła się / nieobecność / przełożona).
          </p>
          <button onClick={() => onGo?.("kalendarz")} className="btn-ghost !py-2 text-[10px]">OZNACZ</button>
        </div>
      )}

      <section>
        <p className="technical text-[10px] text-foreground/50 mb-3">DZIŚ I JUTRO</p>
        {items.length === 0 ? <p className="text-sm text-foreground/40">Nic zaplanowanego.</p> : (
          <div className="border hairline divide-y divide-[#3D3D3F]/60">
            {items.map((x) => (
              <div key={x.kind + x.id} className="p-3 flex flex-wrap items-center gap-3 text-sm">
                <span className="font-mono text-xs text-foreground/60">{plDateTime(x.at)}</span>
                <span className={x.kind === "grupa" ? "gold-text" : x.kind === "blok" ? "blood-text" : ""}>{x.title}</span>
                {x.who && <span className="text-foreground/50 text-xs">{x.who}</span>}
                {x.status && <span className="text-[10px] technical text-foreground/40 ml-auto">{x.status}</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <p className="technical text-[10px] text-foreground/50 mb-3">OSTATNIE ZDARZENIA</p>
        {d.log.length === 0 ? <p className="text-sm text-foreground/40">Brak wpisów.</p> : (
          <div className="space-y-1 text-xs text-foreground/60">
            {d.log.map((l, i) => (
              <p key={i}>{new Date(l.at).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })} · <span className="gold-text">{AKCJA[l.action] || l.action}</span>{l.summary ? ` · ${l.summary}` : ""}</p>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}