import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { uploadAudio } from "@/components/admin/silence/library/libUtils";
import { extractVideoId } from "@/components/exmortis/glos/youtube";
import { statusOf } from "@/components/exmortis/glos/musicUtils";
import { inp, lbl } from "./podAdmin";
import CoverField from "./CoverField";
import SongPreview from "./SongPreview";

const ST = { szkic: "Szkic", opublikowany: "Opublikowany", ukryty: "Ukryty" };

// Sprawdza bezpośredni adres audio w przeglądarce: czy da się wczytać i ile trwa.
const probe = (url) => new Promise((ok, no) => {
  const a = new Audio(); a.preload = "metadata";
  const t = setTimeout(() => no(new Error("Plik nie odpowiada.")), 15000);
  a.onloadedmetadata = () => { clearTimeout(t); ok(Math.round(a.duration) || null); };
  a.onerror = () => { clearTimeout(t); no(new Error("Nie udało się wczytać pliku z tego adresu.")); };
  a.src = url;
});

export default function SongForm({ song, nextOrder, firstOrder = 0, onDone, onCancel }) {
  const [f, setF] = useState(() => (song ? { ...song, status: statusOf(song) } : { tytul: "", autor: "EXMORTIS", status: "szkic", kolejnosc: nextOrder }));
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  // Nowy utwór: domyślnie na końcu listy (decyzja 27.11.2026), z wyborem „na początku”.
  const [pos, setPos] = useState("koniec");
  const set = (p) => setF((v) => ({ ...v, ...p }));
  const up = async (k, fn) => { setBusy(k); setErr(""); try { set(await fn()); } catch (x) { setErr(x.message); } setBusy(""); };

  const check = () => up("probe", async () => {
    if (!/^https:\/\//i.test(f.audio_url || "")) throw new Error("Adres audio musi zaczynać się od https://");
    const d = await probe(f.audio_url); setNote(`Plik działa${d ? ` · ${Math.round(d / 60)} min` : ""}.`); return { dlugosc_s: d || f.dlugosc_s };
  });

  const save = async () => {
    if (!f.tytul?.trim()) return setErr("Podaj tytuł.");
    if (f.youtube_url && !extractVideoId(f.youtube_url)) return setErr("Nieprawidłowy link YouTube.");
    if (f.audio_url && !/^https?:\/\//i.test(f.audio_url)) return setErr("Adres audio musi być pełnym adresem https://");
    if (f.status === "opublikowany" && !f.audio_url && !f.youtube_url) return setErr("Do publikacji potrzebny jest plik audio albo link YouTube.");
    setBusy("save");
    const { id, created_date, updated_date, created_by_id, ...data } = f;
    const rec = { ...data, tytul: f.tytul.trim(), kolejnosc: id ? Number(f.kolejnosc) || 0 : pos === "poczatek" ? firstOrder : nextOrder, widoczny: f.status === "opublikowany", data_dodania: f.data_dodania || new Date().toISOString() };
    try {
      if (id) await base44.entities.Utwor.update(id, rec); else await base44.entities.Utwor.create(rec);
      onDone();
    } catch (x) { setErr(x.message || "Nie udało się zapisać utworu."); setBusy(""); }
  };

  return (
    <div className="border border-[#C9A24A]/40 p-5 space-y-5">
      <h3 className="shop-heading text-xl">{song ? "Edytuj utwór" : "Nowy utwór"}</h3>
      <div className="grid sm:grid-cols-[1fr_1fr_160px] gap-4">
        <label className={lbl}>Tytuł<input className={inp} value={f.tytul} onChange={(e) => set({ tytul: e.target.value })} /></label>
        <label className={lbl}>Autor<input className={inp} value={f.autor || ""} onChange={(e) => set({ autor: e.target.value })} /></label>
        {song ? (
          <label className={lbl}>Kolejność<input type="number" className={inp} value={f.kolejnosc ?? ""} onChange={(e) => set({ kolejnosc: e.target.value })} /></label>
        ) : (
          <label className={lbl}>Miejsce na liście<select className={inp} value={pos} onChange={(e) => setPos(e.target.value)}>
            <option value="koniec" className="bg-black">Na końcu</option>
            <option value="poczatek" className="bg-black">Na początku</option>
          </select></label>
        )}
      </div>
      <div className="grid sm:grid-cols-[1fr_1fr_1fr] gap-4">
        <label className={lbl}>Status<select className={inp} value={f.status} onChange={(e) => set({ status: e.target.value })}>{Object.entries(ST).map(([v, l]) => <option key={v} value={v} className="bg-black">{l}</option>)}</select></label>
        <label className={lbl}>Kategoria (opcjonalnie)<input className={inp} value={f.kategoria || ""} onChange={(e) => set({ kategoria: e.target.value })} placeholder="np. Nadzieja" /></label>
        <label className="flex items-center gap-2 text-xs text-foreground/70 sm:pt-6"><input type="checkbox" checked={!!f.wyrozniony} onChange={(e) => set({ wyrozniony: e.target.checked })} /> Wyróżniony (pierwszy na /glos)</label>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className={lbl}>Plik MP3 / M4A {busy === "audio" && <Loader2 className="inline h-3 w-3 animate-spin" />}
          <input type="file" accept=".mp3,.m4a,.aac,audio/*" className="text-xs" onChange={(e) => { const x = e.target.files[0]; if (x) up("audio", async () => { const r = await uploadAudio(x); setNote("Plik wgrany."); return { audio_url: r.plik, dlugosc_s: r.dlugosc_s || f.dlugosc_s }; }); }} /></label>
        <label className={lbl}>albo bezpośredni adres HTTPS do pliku audio
          <span className="flex gap-2"><input className={inp} value={f.audio_url || ""} onChange={(e) => set({ audio_url: e.target.value.trim() })} placeholder="https://…/utwor.mp3" />
            <button type="button" onClick={check} disabled={!f.audio_url || !!busy} className="btn-ghost !min-h-[38px] !px-3 shrink-0">{busy === "probe" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Sprawdź"}</button></span></label>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className={lbl}>Oficjalny link YouTube (opcjonalnie)<input className={inp} value={f.youtube_url || ""} onChange={(e) => set({ youtube_url: e.target.value.trim() })} /></label>
      </div>
      <CoverField value={f.okladka || ""} youtubeUrl={f.youtube_url} onChange={(url) => set({ okladka: url })} onError={setErr} />
      <label className={lbl}>Opis<textarea rows={2} className={inp} value={f.opis || ""} onChange={(e) => set({ opis: e.target.value })} /></label>
      <label className={lbl}>Tekst utworu (pokazuje się jako rozwijany „Tekst utworu”)<textarea rows={6} className={inp} value={f.tekst || ""} onChange={(e) => set({ tekst: e.target.value })} /></label>
      <SongPreview song={f} />
      {note && <p className="text-xs text-foreground/60">{note}</p>}
      {err && <p className="text-xs blood-text" role="alert">{err}</p>}
      <div className="flex gap-3">
        <button disabled={!!busy} onClick={save} className="btn-relic !py-3 !px-5 disabled:opacity-40">{busy === "save" && <Loader2 className="h-4 w-4 animate-spin" />}Zapisz</button>
        <button onClick={onCancel} className="btn-ghost !py-3 !px-5">Anuluj</button>
      </div>
    </div>
  );
}