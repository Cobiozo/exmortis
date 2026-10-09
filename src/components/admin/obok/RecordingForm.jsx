import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { isoToWarsawLocal, warsawLocalToIso } from "@/lib/warsawTime";
import RecordingUpload from "./RecordingUpload";

const inp = "w-full bg-transparent border hairline px-4 py-3 focus:border-[#C9A24A] focus:outline-none";
const F = ({ l, children }) => <label className="block"><span className="block technical text-[10px] text-foreground/60 mb-2">{l}</span>{children}</label>;

// Edycja nagrania: plik, format, pytanie, transkrypcja, materiał, ostrzeżenie, status.
export default function RecordingForm({ rec, seria, onClose }) {
  const [r, setR] = useState({ ...rec, pub: rec.publikacja ? isoToWarsawLocal(rec.publikacja) : "" });
  const set = (k) => (e) => setR({ ...r, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const save = async () => {
    const { pub, id, created_date, updated_date, created_by_id, ...rest } = r;
    await base44.entities.ObokNagranie.update(rec.id, { ...rest, publikacja: pub ? warsawLocalToIso(pub) : null }); onClose();
  };
  const del = async () => { if (window.confirm("Usunąć nagranie?")) { await base44.entities.ObokNagranie.delete(rec.id); onClose(); } };
  return (
    <section className="border hairline p-6 md:p-8 space-y-5">
      <button onClick={onClose} className="technical text-[10px] gold-text">← NAGRANIA</button>
      <div className="grid md:grid-cols-2 gap-5">
        <F l="Tytuł"><input value={r.tytul || ""} onChange={set("tytul")} className={inp} /></F>
        <F l="Numer"><input type="number" value={r.numer || 0} onChange={(e) => setR({ ...r, numer: Number(e.target.value) })} className={inp} /></F>
        <div className="md:col-span-2"><F l="Krótki opis (do 160 znaków)"><input maxLength={160} value={r.opis || ""} onChange={set("opis")} className={inp} /></F></div>
      </div>
      <RecordingUpload r={r} setR={setR} />
      <F l="Pytanie na wieczór"><textarea rows={2} value={r.pytanie || ""} onChange={set("pytanie")} className={inp} /></F>
      <F l="Transkrypcja"><textarea rows={6} value={r.transkrypcja || ""} onChange={set("transkrypcja")} className={inp} /></F>
      <div className="grid md:grid-cols-2 gap-5">
        <F l="Materiał dodatkowy — nazwa"><input value={r.material_nazwa || ""} onChange={set("material_nazwa")} className={inp} /></F>
        <F l="Materiał dodatkowy — link (https://)"><input value={r.material_url || ""} onChange={set("material_url")} className={inp} /></F>
        {seria.typ !== "sekwencja" && <F l="Publikacja (czas polski)"><input type="datetime-local" value={r.pub} onChange={set("pub")} className={`${inp} dt-input relative`} /></F>}
        <F l="Status"><select value={r.status || "szkic"} onChange={set("status")} className={`${inp} bg-[#0A0A0B]`}><option value="szkic">Szkic</option><option value="zaplanowane">Zaplanowane</option><option value="opublikowane">Opublikowane</option></select></F>
      </div>
      <label className="flex gap-3 items-center text-sm"><input type="checkbox" checked={!!r.ostrzezenie} onChange={set("ostrzezenie")} className="accent-[#C9A24A]" />Ostrzeżenie o trudnych tematach (ramka z numerami pomocowymi)</label>
      <div className="flex gap-4"><button onClick={save} className="btn-relic">ZAPISZ NAGRANIE</button><button onClick={del} className="btn-ghost">USUŃ</button></div>
    </section>
  );
}