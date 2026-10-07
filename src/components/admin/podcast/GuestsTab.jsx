import React, { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { GU, FORMA, inp, lbl, uploadImage } from "./podAdmin";

const ZGODA = { brak: "Brak", wyslana: "Wysłana", podpisana: "Podpisana" };
const EMPTY = { nazwa: "", forma: "imie", bio: "", zgoda_status: "brak" };

export default function GuestsTab() {
  const [list, setList] = useState(null);
  const [f, setF] = useState(null);
  const load = () => GU.filter({}, { sort: "-created_date", limit: 200 }).then((p) => setList(p.items));
  useEffect(() => { load(); }, []);
  const set = (p) => setF((v) => ({ ...v, ...p }));
  const save = async () => {
    if (!f.nazwa.trim()) return;
    const { id, created_date, updated_date, created_by_id, ...d } = f;
    if (id) await GU.update(id, d); else await GU.create(d);
    setF(null); load();
  };
  if (!list) return <p className="text-sm text-foreground/50">Ładowanie…</p>;
  return (
    <div className="space-y-4">
      {f ? (
        <div className="border border-[#C9A24A]/40 p-5 grid sm:grid-cols-2 gap-4">
          <label className={lbl}>Imię lub pseudonim<input className={inp} value={f.nazwa} onChange={(e) => set({ nazwa: e.target.value })} /></label>
          <label className={lbl}>Forma wystąpienia<select className={inp} value={f.forma} onChange={(e) => set({ forma: e.target.value })}>{Object.entries(FORMA).map(([v, l]) => <option key={v} value={v} className="bg-black">{l}</option>)}</select></label>
          <label className={`${lbl} sm:col-span-2`}>Krótkie bio<textarea rows={3} className={inp} value={f.bio || ""} onChange={(e) => set({ bio: e.target.value })} /></label>
          <label className={lbl}>Zdjęcie {f.zdjecie && "· wgrane"}<input type="file" accept="image/*" className="text-xs" onChange={async (e) => e.target.files[0] && set({ zdjecie: await uploadImage(e.target.files[0]) })} /></label>
          <label className={lbl}>Zgoda na publikację<select className={inp} value={f.zgoda_status} onChange={(e) => set({ zgoda_status: e.target.value, zgoda_data: e.target.value === "podpisana" ? new Date().toISOString().slice(0, 10) : f.zgoda_data })}>{Object.entries(ZGODA).map(([v, l]) => <option key={v} value={v} className="bg-black">{l}</option>)}</select></label>
          <label className={lbl}>Plik zgody {f.zgoda_plik && "· wgrany"}<input type="file" accept=".pdf,image/*" className="text-xs" onChange={async (e) => e.target.files[0] && set({ zgoda_plik: (await base44.integrations.Core.UploadPrivateFile({ file: e.target.files[0] })).file_uri })} /></label>
          <label className={lbl}>Linki (po przecinku)<input className={inp} value={(f.linki || []).join(", ")} onChange={(e) => set({ linki: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></label>
          <div className="flex gap-3 sm:col-span-2"><button onClick={save} className="btn-relic !py-3 !px-5">Zapisz</button><button onClick={() => setF(null)} className="btn-ghost !py-3 !px-5">Anuluj</button></div>
        </div>
      ) : <button onClick={() => setF(EMPTY)} className="btn-relic !py-3 !px-5">Nowy gość</button>}
      {list.map((g) => (
        <div key={g.id} className="border hairline p-4 flex items-center gap-4 text-sm">
          <div className="flex-1"><p>{g.nazwa}</p><p className="text-xs text-foreground/45">{FORMA[g.forma]} · zgoda: {ZGODA[g.zgoda_status]}{g.zgoda_data ? ` (${g.zgoda_data})` : ""}</p></div>
          {(g.forma === "pelne" || g.zdjecie) && g.zgoda_status !== "podpisana" && <span className="text-xs text-[#E8C547]">Brak zgody gościa na publikację</span>}
          <button onClick={() => setF(g)} aria-label="Edytuj" className="text-foreground/50 hover:text-[#C9A24A]"><Pencil className="h-4 w-4" /></button>
          <button onClick={async () => { if (window.confirm("Usunąć gościa?")) { await GU.delete(g.id); load(); } }} aria-label="Usuń" className="text-foreground/40 hover:text-[#BC1E22]"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
    </div>
  );
}