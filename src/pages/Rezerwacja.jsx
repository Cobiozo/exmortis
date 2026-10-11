import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import NotFoundContent from "@/components/exmortis/NotFoundContent";
import SlotPicker from "@/components/booking/SlotPicker";
import BookingForm from "@/components/booking/BookingForm";
import { fullLabel, plNote } from "@/components/booking/bookingTime";

const call = (p) => base44.functions.invoke("bookingPublic", p).then((r) => r.data);

export default function Rezerwacja() {
  const { slug } = useParams();
  const [type, setType] = useState(undefined);
  const [slots, setSlots] = useState(null);
  const [pick, setPick] = useState(null);
  const [notice, setNotice] = useState("");
  const [done, setDone] = useState(null);

  const loadSlots = useCallback(() => call({ action: "slots", slug }).then((d) => setSlots(d.slots)).catch(() => setSlots([])), [slug]);
  useEffect(() => {
    call({ action: "type", slug }).then((d) => { setType(d.type); loadSlots(); }).catch(() => setType(null));
  }, [slug, loadSlots]);

  if (type === undefined) return <div className="min-h-[60svh] pt-32 flex justify-center"><div className="w-8 h-8 border-4 border-[#3D3D3F] border-t-[#C9A24A] rounded-full animate-spin" /></div>;
  if (!type) return <NotFoundContent />;

  return (
    <div className="pt-32 pb-24 container-exm">
      <div className="max-w-2xl">
        <p className="technical text-[10px] gold-text mb-3">REZERWACJA · {type.duration_min} MIN</p>
        <h1 className="relic-heading text-4xl mb-4">{type.name}</h1>
        {type.description && <p className="text-foreground/70 mb-10">{type.description}</p>}
        {done ? (
          <div className="border border-[#C9A24A] p-6 space-y-3" role="status">
            <p className="relic-heading text-2xl">Zarezerwowane</p>
            <p>{fullLabel(done.starts_at)}{plNote(done.starts_at) && <span className="text-foreground/50"> ({plNote(done.starts_at)})</span>}</p>
            {done.manage_url && <p className="text-sm text-foreground/70">Zapisz ten link — pokazuje szczegóły Twojej rezerwacji: <Link to={done.manage_url} className="gold-text underline break-all">Moja rezerwacja</Link></p>}
          </div>
        ) : pick ? (
          <div className="space-y-6">
            <button onClick={() => setPick(null)} className="technical text-[10px] text-foreground/50 hover:gold-text">← ZMIEŃ TERMIN</button>
            <BookingForm type={type} slot={pick} onDone={setDone} onTaken={(m) => { setNotice(m); setPick(null); setSlots(null); loadSlots(); }} />
          </div>
        ) : (
          <>
            {notice && <p className="mb-6 text-sm text-[#E8C547]" role="alert">{notice}</p>}
            {slots ? <SlotPicker slots={slots} value={pick} onPick={(s) => { setNotice(""); setPick(s); }} /> : <p className="text-foreground/50">Ładowanie terminów…</p>}
          </>
        )}
      </div>
    </div>
  );
}