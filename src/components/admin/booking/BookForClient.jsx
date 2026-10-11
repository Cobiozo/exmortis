import React, { useState } from "react";
import SlotPicker from "@/components/booking/SlotPicker";
import { bk, inputCls } from "./api";

// MUSI 13: „Umów klienta” — administrator pomija regułę 24 h, ale nie zajmuje zajętego terminu.
// Klient dostaje standardowe potwierdzenie (z plikiem .ics i linkami).
export default function BookForClient({ types, onDone }) {
  const [open, setOpen] = useState(false);
  const [typeId, setTypeId] = useState("");
  const [slots, setSlots] = useState(null);
  const [pick, setPick] = useState(null);
  const [form, setForm] = useState({ first_name: "", email: "" });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const loadSlots = async (id) => {
    setTypeId(id); setSlots(null); setPick(null); setErr("");
    if (!id) return;
    const r = await bk("slots", { type_id: id }).catch((e) => { setErr(e.message); return { slots: [] }; });
    setSlots(r.slots);
  };

  const submit = async () => {
    if (!pick || busy) return;
    setBusy(true); setErr(""); setMsg("");
    try {
      await bk("book", { type_id: typeId, starts_at: pick.start, first_name: form.first_name.trim(), email: form.email.trim() });
      setMsg("Umówione. Klient dostał potwierdzenie.");
      setSlots(null); setPick(null); setForm({ first_name: "", email: "" }); setTypeId("");
      onDone?.();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <section className="border hairline p-5 space-y-4">
      <button onClick={() => setOpen(!open)} className="technical text-[10px] gold-text">UMÓW KLIENTA {open ? "−" : "+"}</button>
      {open && (
        <div className="space-y-5">
          <div className="grid sm:grid-cols-3 gap-3">
            <select value={typeId} onChange={(e) => loadSlots(e.target.value)} className={inputCls}>
              <option value="">Rodzaj spotkania…</option>
              {(types || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} placeholder="Imię" className={inputCls} />
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="E-mail klienta" type="email" className={inputCls} />
          </div>
          {slots && <SlotPicker slots={slots} value={pick} onPick={setPick} />}
          <button onClick={submit} disabled={!pick || !form.first_name.trim() || !form.email.trim() || busy} className="btn-relic !py-3 text-[10px] disabled:opacity-50">
            {busy ? "ZAPISUJĘ…" : "UMÓW I WYŚLIJ POTWIERDZENIE"}
          </button>
          <p className="text-xs text-foreground/45">Reguła 24 godzin nie obowiązuje administratora. Zajętego terminu nie da się wybrać.</p>
        </div>
      )}
      {msg && <p className="text-sm gold-text" role="status">{msg}</p>}
      {err && <p className="text-sm text-[#E8C547]" role="alert">{err}</p>}
    </section>
  );
}