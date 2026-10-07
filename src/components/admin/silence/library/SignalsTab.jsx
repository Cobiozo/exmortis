import React, { useEffect, useState } from "react";
import { Loader2, Star, Trash2 } from "lucide-react";
import { SIGNAL, uploadAudio, fmt } from "./libUtils";

const TYPES = [{ id: "wstep", label: "Wstęp (3–10 s)" }, { id: "zakonczenie", label: "Zakończenie (ok. 15 s)" }];

// Sygnały: wstęp i zakończenie, wspólne dla wszystkich czasów i utworów.
export default function SignalsTab() {
  const [list, setList] = useState(null);
  const [form, setForm] = useState({ typ: "wstep", nazwa: "" });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const load = () => SIGNAL.filter({}, { limit: 100 }).then((p) => setList(p.items));
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!form.nazwa.trim() || !file) return setErr("Podaj nazwę i wybierz plik.");
    setBusy(true); setErr("");
    try {
      const up = await uploadAudio(file);
      const first = !list.some((s) => s.typ === form.typ);
      await SIGNAL.create({ ...form, ...up, nazwa: form.nazwa.trim(), aktywny: true, domyslny: first, korekta_db: 0 });
      setForm({ ...form, nazwa: "" }); setFile(null); e.target.reset(); load();
    } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  const setDefault = async (s) => {
    await SIGNAL.updateMany({ typ: s.typ, domyslny: true }, { $set: { domyslny: false } });
    await SIGNAL.update(s.id, { domyslny: true });
    load();
  };
  const patch = async (s, p) => { await SIGNAL.update(s.id, p); load(); };
  const remove = async (s) => { if (window.confirm(`Usunąć „${s.nazwa}”?`)) { await SIGNAL.delete(s.id); load(); } };

  if (!list) return <p className="text-foreground/50 text-sm">Ładowanie…</p>;
  return (
    <div className="space-y-8">
      {TYPES.map((ty) => (
        <div key={ty.id} className="space-y-2">
          <p className="technical text-[10px] gold-text">{ty.label}</p>
          {!list.some((s) => s.typ === ty.id) && <p className="text-xs text-foreground/40">Brak — sesja zacznie się / skończy bez sygnału.</p>}
          {list.filter((s) => s.typ === ty.id).map((s) => (
            <div key={s.id} className="border hairline p-3 flex flex-wrap items-center gap-4">
              <span className="text-sm flex-1 min-w-[140px]">{s.nazwa} <span className="text-xs text-foreground/40">· {fmt(s.dlugosc_s)}</span></span>
              <audio controls preload="none" src={s.plik} className="h-8 max-w-[240px]" />
              <label className="text-xs text-foreground/50 flex items-center gap-2">{s.korekta_db > 0 ? "+" : ""}{s.korekta_db || 0} dB
                <input type="range" min="-6" max="6" step="0.5" defaultValue={s.korekta_db || 0} onMouseUp={(e) => patch(s, { korekta_db: Number(e.target.value) })} onTouchEnd={(e) => patch(s, { korekta_db: Number(e.target.value) })} className="accent-[#C9A24A] w-24" />
              </label>
              <label className="text-xs text-foreground/50 flex items-center gap-1"><input type="checkbox" checked={s.aktywny} onChange={(e) => patch(s, { aktywny: e.target.checked })} className="accent-[#C9A24A]" />aktywny</label>
              <button onClick={() => setDefault(s)} aria-label="Ustaw jako domyślny" className={s.domyslny ? "text-[#C9A24A]" : "text-foreground/30 hover:text-foreground"}><Star className="h-4 w-4" /></button>
              <button onClick={() => remove(s)} aria-label="Usuń" className="text-foreground/40 hover:text-[#BC1E22]"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      ))}
      <form onSubmit={add} className="border border-[#C9A24A]/40 p-4 flex flex-wrap items-end gap-3">
        <select value={form.typ} onChange={(e) => setForm({ ...form, typ: e.target.value })} className="bg-black border hairline px-3 py-2 text-sm">
          {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <input value={form.nazwa} onChange={(e) => setForm({ ...form, nazwa: e.target.value })} placeholder="Nazwa, np. Misa" className="bg-transparent border hairline px-3 py-2 text-sm" />
        <input type="file" accept=".mp3,.m4a,.aac,audio/mpeg,audio/mp4" onChange={(e) => setFile(e.target.files?.[0])} className="text-xs" />
        <button disabled={busy} className="btn-relic !py-3 !px-5">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Dodaj sygnał</button>
        {err && <p className="w-full text-xs text-[#E8C547]">{err}</p>}
      </form>
    </div>
  );
}