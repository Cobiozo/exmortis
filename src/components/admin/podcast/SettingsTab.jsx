import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { inp, lbl, uploadImage } from "./podAdmin";

const S = base44.entities.PodcastSettings;
const FIELDS = [["nazwa", "Nazwa"], ["spotify", "Link Spotify"], ["youtube", "Link YouTube"], ["apple", "Link Apple Podcasts"], ["rss", "Kanał RSS (publiczny)"], ["rss_import", "Adres RSS do importu"], ["zwiastun_tekst", "Tekst przed pierwszym odcinkiem"]];

export default function SettingsTab() {
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState("");
  useEffect(() => { S.filter({}, { limit: 1 }).then((p) => setF(p.items[0] || { nazwa: "Podcast exmortis" })); }, []);
  const set = (p) => setF((v) => ({ ...v, ...p }));
  const reasons = (e) => String(e?.response?.data?.error || e?.data?.error || e?.message || e);
  const save = async () => {
    setBusy("save"); setErr(false); setMsg("");
    try {
      const { id, created_date, updated_date, created_by_id, ...d } = f;
      if (id) await S.update(id, d); else setF(await S.create(d));
      setMsg("Zapisano"); setTimeout(() => setMsg(""), 2500);
    } catch (e) {
      setErr(true); setMsg(`Nie udało się zapisać: ${reasons(e)}`);
    } finally { setBusy(""); }
  };
  const importRss = async () => {
    setBusy("rss"); setErr(false); setMsg("");
    try {
      const r = await base44.functions.invoke("adminContent", { action: "rss_import" });
      const d = r?.data || {};
      setMsg(`Import gotowy — dodano ${d.dodane ?? 0}, zaktualizowano ${d.zaktualizowane ?? 0}. Na liście: ${d.odcinki ?? 0} odcinków.`);
    } catch (e) {
      setErr(true); setMsg(`Nie udało się zaimportować: ${reasons(e)}`);
    } finally { setBusy(""); }
  };
  if (!f) return <p className="text-sm text-foreground/50">Ładowanie…</p>;
  return (
    <div className="space-y-4 max-w-2xl">
      {FIELDS.map(([k, l]) => <label key={k} className={lbl}>{l}<input className={inp} value={f[k] || ""} onChange={(e) => set({ [k]: e.target.value })} /></label>)}
      <label className={lbl}>Opis<textarea rows={3} className={inp} value={f.opis || ""} onChange={(e) => set({ opis: e.target.value })} /></label>
      <label className={lbl}>Okładka (kwadrat 3000×3000 px) {f.okladka && <img src={f.okladka} alt="" className="h-16 w-16 inline ml-2" />}
        <input type="file" accept="image/*" className="text-xs" onChange={async (e) => e.target.files[0] && set({ okladka: await uploadImage(e.target.files[0]) })} /></label>
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={!!busy} className="btn-relic !py-3 !px-5 disabled:opacity-60">{busy === "save" ? "Zapisuję…" : "Zapisz"}</button>
        <button onClick={importRss} disabled={!!busy} className="btn-ghost !py-3 !px-5 disabled:opacity-60">{busy === "rss" ? "Importuję…" : "Importuj odcinki z RSS"}</button>
        <span className={`text-xs ${err ? "blood-text" : "gold-text"}`}>{msg}</span>
      </div>
    </div>
  );
}