import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { CATS } from "@/components/exmortis/cisza/library";
import { TRACK, TIMES, MAX_MB, uploadAudio, checkFile, fmt } from "./libUtils";

const inp = "w-full bg-transparent border hairline px-3 py-2 text-sm";
const lbl = "block text-xs text-foreground/60 space-y-1.5";

// Dodawanie i edycja utworu biblioteki.
export default function TrackForm({ track, tracks, backdrops, order, onDone, onCancel }) {
  const [f, setF] = useState(track || { nazwa: "", opis: "", kategoria: "muzyka", korekta_db: 0, start_tryb: "poczatek", start_minuta: 0, zapetlaj: true, przenikanie_s: 4, czasy: [], kolor: "#1A1712", aktywny: true, domyslny: !tracks.length });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (p) => setF((v) => ({ ...v, ...p }));
  const toggleTime = (m) => set({ czasy: f.czasy?.includes(m) ? f.czasy.filter((x) => x !== m) : [...(f.czasy || []), m].sort((a, b) => a - b) });

  const save = async (e) => {
    e.preventDefault();
    if (!f.nazwa.trim()) return setErr("Podaj nazwę.");
    if (!file && !f.plik) return setErr("Wybierz plik audio.");
    setBusy(true); setErr("");
    try {
      const up = file ? await uploadAudio(file) : {};
      const { id, created_date, updated_date, created_by_id, ...rest } = f;
      const data = { ...rest, ...up, nazwa: f.nazwa.trim(), opis: (f.opis || "").slice(0, 60), korekta_db: Number(f.korekta_db) || 0, start_minuta: Number(f.start_minuta) || 0, przenikanie_s: Math.max(2, Math.min(8, Number(f.przenikanie_s) || 4)) };
      if (data.domyslny) await TRACK.updateMany({ domyslny: true }, { $set: { domyslny: false } });
      if (id) await TRACK.update(id, data); else await TRACK.create({ ...data, kolejnosc: order });
      onDone();
    } catch (x) { setErr(x.message); setBusy(false); }
  };

  return (
    <form onSubmit={save} className="border border-[#C9A24A]/40 p-5 space-y-4">
      <p className="technical text-[10px] gold-text">{track ? "EDYCJA UTWORU" : "NOWY UTWÓR"}</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className={lbl}>Nazwa<input className={inp} value={f.nazwa} onChange={(e) => set({ nazwa: e.target.value })} placeholder="Fortepian w ciemności" /></label>
        <label className={lbl}>Opis (do 60 znaków)<input className={inp} maxLength={60} value={f.opis || ""} onChange={(e) => set({ opis: e.target.value })} placeholder="fortepian, bardzo wolno, bez rytmu" /></label>
        <label className={lbl}>Kategoria
          <select className={inp} value={f.kategoria} onChange={(e) => set({ kategoria: e.target.value, start_tryb: track ? f.start_tryb : e.target.value === "natura" ? "losowe" : "poczatek" })}>
            {CATS.map((c) => <option key={c.id} value={c.id} className="bg-black">{c.label}</option>)}
          </select>
        </label>
        <label className={lbl}>Plik (MP3 / M4A, do {MAX_MB} MB){f.plik && !file && <span className="text-foreground/40"> · {f.plik_nazwa} · {fmt(f.dlugosc_s)}</span>}
          <input type="file" accept=".mp3,.m4a,.aac,audio/mpeg,audio/mp4,audio/aac" onChange={(e) => { const x = e.target.files?.[0]; setFile(x); setErr(x ? checkFile(x) : ""); }} className="text-xs" />
        </label>
        <label className={lbl}>Korekta głośności: {Number(f.korekta_db) > 0 ? "+" : ""}{f.korekta_db} dB
          <input type="range" min="-6" max="6" step="0.5" value={f.korekta_db} onChange={(e) => set({ korekta_db: e.target.value })} className="w-full accent-[#C9A24A]" />
        </label>
        <label className={lbl}>Punkt startu
          <div className="flex gap-2">
            <select className={inp} value={f.start_tryb} onChange={(e) => set({ start_tryb: e.target.value })}>
              <option value="poczatek" className="bg-black">Od początku</option>
              <option value="losowe" className="bg-black">Losowe miejsce</option>
              <option value="minuta" className="bg-black">Od minuty…</option>
            </select>
            {f.start_tryb === "minuta" && <input type="number" min="0" className={`${inp} w-20`} value={f.start_minuta} onChange={(e) => set({ start_minuta: e.target.value })} />}
          </div>
        </label>
        <label className={lbl}>Gdy utwór jest krótszy niż sesja
          <select className={inp} value={f.zapetlaj ? "loop" : "next"} onChange={(e) => set({ zapetlaj: e.target.value === "loop" })}>
            <option value="loop" className="bg-black">Zapętlaj z przenikaniem</option>
            <option value="next" className="bg-black">Przejdź do innego utworu</option>
          </select>
        </label>
        {f.zapetlaj ? (
          <label className={lbl}>Przenikanie pętli (2–8 s)<input type="number" min="2" max="8" className={inp} value={f.przenikanie_s} onChange={(e) => set({ przenikanie_s: e.target.value })} /></label>
        ) : (
          <label className={lbl}>Następny utwór
            <select className={inp} value={f.nastepny_id || ""} onChange={(e) => set({ nastepny_id: e.target.value })}>
              <option value="" className="bg-black">— brak (cisza po końcu pliku) —</option>
              {tracks.filter((t) => t.id !== f.id).map((t) => <option key={t.id} value={t.id} className="bg-black">{t.nazwa}</option>)}
            </select>
          </label>
        )}
        <label className={lbl}>Proponowane tło
          <select className={inp} value={f.tlo_id || ""} onChange={(e) => set({ tlo_id: e.target.value })}>
            <option value="" className="bg-black">— brak —</option>
            {backdrops.map((b) => <option key={b.id} value={b.id} className="bg-black">{b.nazwa}</option>)}
          </select>
        </label>
        <label className={lbl}>Kolor kafelka<input type="color" value={f.kolor || "#1A1712"} onChange={(e) => set({ kolor: e.target.value })} className="h-9 w-16 bg-transparent" /></label>
      </div>
      <div className="text-xs text-foreground/60">
        Dostępny dla czasów: {!f.czasy?.length && <span className="gold-text">wszystkich</span>}
        <div className="flex flex-wrap gap-2 mt-2">
          {TIMES.map((m) => (
            <button type="button" key={m} onClick={() => toggleTime(m)} className={`px-3 py-1 border ${f.czasy?.includes(m) ? "border-[#C9A24A] text-[#C9A24A]" : "hairline text-foreground/50"}`}>{m} min</button>
          ))}
        </div>
      </div>
      <div className="flex gap-5 text-xs text-foreground/60">
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.aktywny} onChange={(e) => set({ aktywny: e.target.checked })} className="accent-[#C9A24A]" />Aktywny</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.domyslny} onChange={(e) => set({ domyslny: e.target.checked })} className="accent-[#C9A24A]" />Domyślny</label>
      </div>
      {err && <p className="text-xs text-[#E8C547]">{err}</p>}
      <div className="flex gap-3">
        <button disabled={busy} className="btn-relic !py-3 !px-5">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy && file ? "Wgrywanie…" : "Zapisz"}</button>
        <button type="button" onClick={onCancel} className="btn-ghost !py-3 !px-5">Anuluj</button>
      </div>
    </form>
  );
}