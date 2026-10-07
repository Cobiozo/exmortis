import React, { useState } from "react";
import { X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { APP, STATUSES, SMIERC, FORMA, label } from "./appUtils";

export default function ApplicationCard({ a, onChange, onClose }) {
  const [notes, setNotes] = useState(a.notatki || "");
  const [busy, setBusy] = useState(false);
  const patch = async (p) => { const r = await APP.update(a.id, p); onChange(r); };
  const setStatus = (status) => patch({ status, historia: [...(a.historia || []), { status, at: new Date().toISOString() }] });
  const makeGuest = async () => {
    setBusy(true);
    const g = await base44.entities.PodcastGuest.create({ nazwa: a.name, forma: a.forma, email: a.email, zgloszenie_id: a.id, zgoda_status: "brak", linki: a.social ? [a.social] : [] });
    await patch({ guest_id: g.id });
    setBusy(false);
  };
  const del = async () => { if (window.confirm("Usunąć to zgłoszenie na stałe?")) { await APP.delete(a.id); onChange(null); } };

  return (
    <div className="border border-[#C9A24A]/40 p-6 space-y-5 bg-[#0A0A0B]">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          {a.pilne && <span className="inline-block bg-[#BC1E22] text-[#F5EFE1] technical text-[10px] px-2 py-1 mb-2">SPRAWDŹ PILNIE</span>}
          <p className="shop-heading text-2xl text-[#F5EFE1]">{a.name}</p>
          <p className="text-xs text-foreground/50">{a.email}{a.phone ? ` · ${a.phone}` : ""}{a.social ? ` · ${a.social}` : ""}</p>
          <p className="text-xs text-foreground/50">{SMIERC[a.smierc]} · {FORMA[a.forma]} · {new Date(a.created_date).toLocaleString("pl-PL")}</p>
        </div>
        <button onClick={onClose} aria-label="Zamknij"><X className="h-5 w-5 text-foreground/50" /></button>
      </div>
      <div><p className="technical text-[10px] gold-text mb-2">DROGA</p><p className="text-sm text-foreground/75 whitespace-pre-line leading-relaxed">{a.story}</p></div>
      <div><p className="technical text-[10px] gold-text mb-2">GDZIE JEST DZIŚ</p><p className="text-sm text-foreground/75 whitespace-pre-line">{a.today}</p></div>
      <div className="flex flex-wrap items-center gap-3">
        <select value={a.status} onChange={(e) => setStatus(e.target.value)} className="bg-black border hairline px-3 py-2 text-sm">{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        {a.guest_id ? <span className="text-xs gold-text">Gość utworzony</span> : <button disabled={busy} onClick={makeGuest} className="btn-ghost !py-2 !px-4 text-[10px]">Utwórz gościa z tego zgłoszenia</button>}
        <button onClick={del} className="text-xs blood-text underline ml-auto">Usuń zgłoszenie</button>
      </div>
      <label className="block text-xs text-foreground/60 space-y-2">Notatki prywatne
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (a.notatki || "") && patch({ notatki: notes })} className="w-full bg-transparent border hairline px-3 py-2 text-sm" />
      </label>
      <div className="text-xs text-foreground/45 space-y-1"><p className="technical text-[10px]">HISTORIA</p>
        {(a.historia || []).map((h, i) => <p key={i}>{new Date(h.at).toLocaleString("pl-PL")} — {label(h.status)}</p>)}
      </div>
    </div>
  );
}