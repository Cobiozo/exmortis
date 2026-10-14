import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { fullLabel, plNote, viewerTz } from "./bookingTime";

const inp = "w-full bg-[#0A0A0B] border hairline px-4 py-3 focus:border-[#C9A24A] outline-none";

export default function BookingForm({ type, slot, onDone, onTaken }) {
  const [f, setF] = useState({ first_name: "", email: "", answers: {}, consent: false, health_consent: false, website: "" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const idem = useMemo(() => crypto.randomUUID(), [slot.start]);
  const healthQ = type.questions.find((q) => q.health);
  const healthFilled = !!(healthQ && (f.answers[healthQ.id] || "").trim());
  const setA = (id, v) => setF({ ...f, answers: { ...f.answers, [id]: v } });

  const submit = async (e) => {
    e.preventDefault(); if (busy) return;
    setErr(""); setBusy(true);
    try {
      const r = await base44.functions.invoke("bookingPublic", { action: "book", slug: type.slug, starts_at: slot.start, tz: viewerTz(), idem_key: idem, ...f });
      onDone(r.data);
    } catch (e2) {
      const st = e2?.response?.status, msg = e2?.response?.data?.error || "Nie udało się zarezerwować. Spróbuj ponownie.";
      if (st === 409 && /zajął/.test(msg)) onTaken(msg); else setErr(msg);
      setBusy(false);
    }
  };
  const note = plNote(slot.start);
  return (
    <form onSubmit={submit} className="space-y-5">
      <p className="relic-heading text-xl">{fullLabel(slot.start)}{note && <span className="block text-xs font-mono text-foreground/55 mt-1">{note}</span>}</p>
      <input className="hidden" tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} aria-hidden="true" />
      <label className="block text-sm">Imię<input required maxLength={120} className={inp} value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} /></label>
      <label className="block text-sm">E-mail<input required type="email" maxLength={320} className={inp} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
      {type.questions.map((q) => (
        <label key={q.id} className="block text-sm">{q.label}{!q.required && <span className="text-foreground/55"> (nieobowiązkowe)</span>}
          <textarea rows={3} maxLength={2000} required={q.required} className={inp} value={f.answers[q.id] || ""} onChange={(e) => setA(q.id, e.target.value)} />
        </label>
      ))}
      {healthFilled && (
        <label className="flex gap-3 text-sm"><input type="checkbox" required checked={f.health_consent} onChange={(e) => setF({ ...f, health_consent: e.target.checked })} />
          <span>Zgadzam się na przetwarzanie podanych informacji o zdrowiu wyłącznie w celu przygotowania rozmowy. Dane zostaną usunięte 60 dni po rozmowie.</span></label>
      )}
      <label className="flex gap-3 text-sm"><input type="checkbox" required checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} />
        <span>Akceptuję <Link to="/regulamin" className="gold-text underline">regulamin</Link> i <Link to="/polityka-prywatnosci" className="gold-text underline">politykę prywatności</Link>.</span></label>
      {err && <p className="text-sm text-[#E8C547]" role="alert">{err}</p>}
      <button type="submit" disabled={busy} className="btn-relic w-full sm:w-auto">{busy ? "Rezerwuję…" : "REZERWUJĘ"}</button>
    </form>
  );
}