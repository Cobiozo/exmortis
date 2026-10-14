import React, { useEffect, useState } from "react";
import { bk, plDateTime } from "./api";

// Odpowiedzi przychodzą pod kluczami pytań (q1, q2…). Podmieniamy je na treść pytania, żeby panel był czytelny.
const labelOf = (booking, id) => (booking?.questions || []).find((q) => q.id === id)?.label || id;
const healthLabel = (booking) => (booking?.questions || []).find((q) => q.health)?.label || "Zdrowie (zgoda)";

export default function BookingsList() {
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(null);
  useEffect(() => { bk("bookings").then((r) => setList(r.bookings)).catch(() => setList([])); }, []);
  const show = async (id) => setOpen(await bk("detail", { id }).catch((e) => ({ error: e.message })));
  if (!list) return <p className="text-sm text-foreground/50">Ładowanie…</p>;
  if (!list.length) return <p className="text-sm text-foreground/50">Brak rezerwacji.</p>;
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-2">
        {list.map((b) => (
          <button key={b.id} onClick={() => show(b.id)} className="block w-full text-left border hairline p-3 text-sm hover:border-[#C9A24A]">
            <span className="font-mono">{plDateTime(b.starts_at)}</span> · {b.type} · {b.first_name} <span className="text-foreground/50">({b.status})</span>
          </button>
        ))}
      </div>
      {open && (
        <div className="border hairline p-5 text-sm space-y-2">
          {open.error ? <p className="blood-text">{open.error}</p> : <>
            <p className="relic-heading text-lg">{open.booking.first_name} · {open.booking.type}</p>
            <p>{open.booking.email}</p>
            {open.booking.zoom_link && <p>Zoom: {open.booking.zoom_link}</p>}
            {open.detail?.deleted_at && <p className="text-foreground/50">Odpowiedzi usunięte (60 dni po rozmowie).</p>}
            {Object.entries(open.detail?.answers || {}).map(([k, v]) => (
              <p key={k} className="whitespace-pre-wrap"><span className="gold-text">{labelOf(open.booking, k)}:</span> {v}</p>
            ))}
            {open.detail?.health && <p className="whitespace-pre-wrap"><span className="blood-text">{healthLabel(open.booking)}:</span> {open.detail.health}</p>}
          </>}
        </div>
      )}
    </div>
  );
}