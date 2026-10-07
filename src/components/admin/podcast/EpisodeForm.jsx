import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import RichTextEditor from "@/components/admin/RichTextEditor";
import { uploadAudio } from "@/components/admin/silence/library/libUtils";
import { TEMATY, TRUDNE, slugify } from "@/components/exmortis/podcast/podcastUtils";
import { EP, inp, lbl, STATUS, uploadImage, publishErrors } from "./podAdmin";
import ListField from "./ListField";

const toLocal = (iso) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

export default function EpisodeForm({ ep, guests, nextNum, onDone, onCancel }) {
  const [f, setF] = useState(ep || { numer: nextNum, tytul: "", slug: "", status: "szkic", tematy: [], ostrzezenia: [], goscie: [], cytaty: [], materialy: [] });
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const set = (p) => setF((v) => ({ ...v, ...p }));
  const tog = (k, v) => set({ [k]: f[k]?.includes(v) ? f[k].filter((x) => x !== v) : [...(f[k] || []), v] });
  const up = async (k, file, fn) => { setBusy(k); try { set(await fn(file)); } catch (x) { setErr(x.message); } setBusy(""); };
  const errs = publishErrors(f, guests);

  const save = async () => {
    if (!f.tytul.trim()) return setErr("Podaj tytuł.");
    if (errs.length) return setErr(errs.join(" "));
    setBusy("save");
    const g = guests.filter((x) => f.goscie?.includes(x.id));
    const { id, created_date, updated_date, created_by_id, ...data } = f;
    const rec = { ...data, slug: f.slug || slugify(f.tytul), numer: Number(f.numer) || null, opis_krotki: (f.opis_krotki || "").slice(0, 200),
      gosc_nazwa: g.map((x) => (x.forma === "anonimowo" ? "Gość anonimowy" : x.nazwa)).join(", "), gosc_bio: g.map((x) => x.bio).filter(Boolean).join("\n\n"),
      cytaty: (f.cytaty || []).filter(Boolean).slice(0, 5), materialy: (f.materialy || []).filter((m) => m.url) };
    if (id) await EP.update(id, rec); else await EP.create(rec);
    onDone();
  };

  return (
    <div className="border border-[#C9A24A]/40 p-5 space-y-5">
      <div className="grid sm:grid-cols-[100px_1fr_1fr] gap-4">
        <label className={lbl}>Numer<input type="number" className={inp} value={f.numer ?? ""} onChange={(e) => set({ numer: e.target.value })} /></label>
        <label className={lbl}>Tytuł<input className={inp} value={f.tytul} onChange={(e) => set({ tytul: e.target.value, slug: ep ? f.slug : slugify(e.target.value) })} /></label>
        <label className={lbl}>Adres (slug)<input className={inp} value={f.slug} onChange={(e) => set({ slug: slugify(e.target.value) })} /></label>
      </div>
      <label className={lbl}>Krótki opis ({(f.opis_krotki || "").length}/200)<textarea maxLength={200} rows={2} className={inp} value={f.opis_krotki || ""} onChange={(e) => set({ opis_krotki: e.target.value })} /></label>
      <div className={lbl}>Notatki<div className="rich-admin"><RichTextEditor value={f.notatki} onChange={(v) => set({ notatki: v })} /></div></div>
      <div className="grid sm:grid-cols-3 gap-4">
        <label className={lbl}>Status<select className={inp} value={f.status} onChange={(e) => set({ status: e.target.value })}>{Object.entries(STATUS).map(([v, l]) => <option key={v} value={v} className="bg-black">{l}</option>)}</select></label>
        <label className={lbl}>Publikacja (data i godzina)<input type="datetime-local" className={inp} value={toLocal(f.publikacja)} onChange={(e) => set({ publikacja: e.target.value ? new Date(e.target.value).toISOString() : "" })} /></label>
        <label className={lbl}>Długość (s){f.dlugosc_s ? ` · ${Math.round(f.dlugosc_s / 60)} min` : ""}<input type="number" className={inp} value={f.dlugosc_s ?? ""} onChange={(e) => set({ dlugosc_s: Number(e.target.value) || null })} /></label>
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        <label className={lbl}>Plik audio {busy === "audio" && <Loader2 className="inline h-3 w-3 animate-spin" />}{f.audio && <span className="text-foreground/40"> · wgrany</span>}
          <input type="file" accept=".mp3,.m4a,audio/*" className="text-xs" onChange={(e) => e.target.files[0] && up("audio", e.target.files[0], async (x) => { const r = await uploadAudio(x); return { audio: r.plik, dlugosc_s: r.dlugosc_s || f.dlugosc_s }; })} /></label>
        <label className={lbl}>Link Spotify (odcinek)<input className={inp} value={f.spotify || ""} onChange={(e) => set({ spotify: e.target.value })} /></label>
        <label className={lbl}>Link YouTube<input className={inp} value={f.youtube || ""} onChange={(e) => set({ youtube: e.target.value })} /></label>
      </div>
      <label className={lbl}>Okładka odcinka (opcjonalnie) {busy === "img" && <Loader2 className="inline h-3 w-3 animate-spin" />}{f.okladka && <img src={f.okladka} alt="" className="h-12 w-12 inline ml-2" />}
        <input type="file" accept="image/*" className="text-xs" onChange={(e) => e.target.files[0] && up("img", e.target.files[0], async (x) => ({ okladka: await uploadImage(x) }))} /></label>
      <Chips label="Goście" items={guests.map((g) => [g.id, g.nazwa])} value={f.goscie} onToggle={(v) => tog("goscie", v)} />
      <Chips label="Tematy" items={TEMATY} value={f.tematy} onToggle={(v) => tog("tematy", v)} />
      <Chips label="Ostrzeżenie o treści" items={TRUDNE.map((t) => [t, t])} value={f.ostrzezenia} onToggle={(v) => tog("ostrzezenia", v)} />
      <label className={lbl}>Rozdziały (każdy w linii: mm:ss — tytuł)<textarea rows={4} className={`${inp} font-mono`} value={f.rozdzialy || ""} onChange={(e) => set({ rozdzialy: e.target.value })} placeholder={"00:00 — Wstęp\n04:12 — Moment, w którym pękło"} /></label>
      <label className={lbl}>Transkrypcja <input type="file" accept=".txt,.vtt" className="text-xs ml-2" onChange={async (e) => e.target.files[0] && set({ transkrypcja: await e.target.files[0].text() })} /><textarea rows={4} className={inp} value={f.transkrypcja || ""} onChange={(e) => set({ transkrypcja: e.target.value })} /></label>
      <ListField label="Cytaty do social media (1–5)" max={5} value={f.cytaty || []} onChange={(v) => set({ cytaty: v })} />
      <ListField label="Materiały (nazwa | link)" max={10} value={(f.materialy || []).map((m) => `${m.nazwa || ""} | ${m.url || ""}`)} onChange={(v) => set({ materialy: v.map((s) => { const [n, u] = s.split("|"); return { nazwa: n?.trim(), url: u?.trim() }; }) })} />
      <div className="grid sm:grid-cols-2 gap-4">
        <label className={lbl}>Przycisk — etykieta<input className={inp} value={f.cta_etykieta || ""} onChange={(e) => set({ cta_etykieta: e.target.value })} placeholder="Zrób test: Która śmierć jest Twoja?" /></label>
        <label className={lbl}>Przycisk — link<input className={inp} value={f.cta_link || ""} onChange={(e) => set({ cta_link: e.target.value })} placeholder="/test" /></label>
      </div>
      {errs.map((x) => <p key={x} className="text-xs text-[#E8C547]">{x}</p>)}
      {err && <p className="text-xs blood-text">{err}</p>}
      <div className="flex gap-3">
        <button disabled={!!busy || errs.length > 0} onClick={save} className="btn-relic !py-3 !px-5 disabled:opacity-40">{busy === "save" && <Loader2 className="h-4 w-4 animate-spin" />}Zapisz</button>
        <button onClick={onCancel} className="btn-ghost !py-3 !px-5">Anuluj</button>
      </div>
    </div>
  );
}

function Chips({ label, items, value = [], onToggle }) {
  return (
    <div className="text-xs text-foreground/60">{label}
      <div className="flex flex-wrap gap-2 mt-2">
        {!items.length && <span className="text-foreground/35">— brak —</span>}
        {items.map(([v, l]) => <button type="button" key={v} onClick={() => onToggle(v)} className={`px-3 py-1 border ${value.includes(v) ? "border-[#C9A24A] text-[#C9A24A]" : "hairline text-foreground/50"}`}>{l}</button>)}
      </div>
    </div>
  );
}