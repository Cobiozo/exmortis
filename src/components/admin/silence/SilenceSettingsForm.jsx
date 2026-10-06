import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

const E = base44.entities.SilenceSettings;
const field = "w-full bg-[#0A0A0B] border hairline px-3 py-2 text-sm";

// Ustawienia ciszy — jeden rekord.
export default function SilenceSettingsForm({ settings, onSaved }) {
  const [v, setV] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const set = (k, val) => { setV({ ...v, [k]: val }); setOk(false); };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    const data = {
      glosnosc_domyslna: Math.max(0, Math.min(100, Number(v.glosnosc_domyslna) || 0)),
      dzwiek_domyslnie: v.dzwiek_domyslnie,
      wyciszanie_melodii_s: Math.max(0, Number(v.wyciszanie_melodii_s) || 0),
      tekst_na_koniec: v.tekst_na_koniec,
    };
    const rec = v.id ? await E.update(v.id, data) : await E.create(data);
    setV({ ...v, ...data, id: v.id || rec.id });
    onSaved({ ...data, id: v.id || rec.id });
    setBusy(false);
    setOk(true);
  };

  return (
    <form onSubmit={save} className="border hairline p-6 bg-[#0F0F10] grid md:grid-cols-2 gap-5">
      <h3 className="relic-heading text-2xl md:col-span-2">Ustawienia ciszy</h3>
      <label className="text-xs text-foreground/60 space-y-2">Głośność domyślna (%)
        <input type="number" min="0" max="100" value={v.glosnosc_domyslna} onChange={(e) => set("glosnosc_domyslna", e.target.value)} className={field} />
      </label>
      <label className="text-xs text-foreground/60 space-y-2">Dźwięk domyślnie
        <select value={v.dzwiek_domyslnie} onChange={(e) => set("dzwiek_domyslnie", e.target.value)} className={field}>
          <option value="wlaczony">Włączony</option>
          <option value="wyciszony">Wyciszony</option>
        </select>
      </label>
      <label className="text-xs text-foreground/60 space-y-2">Wyciszanie melodii (s)
        <input type="number" min="0" max="30" value={v.wyciszanie_melodii_s} onChange={(e) => set("wyciszanie_melodii_s", e.target.value)} className={field} />
      </label>
      <label className="text-xs text-foreground/60 space-y-2">Tekst na koniec
        <input value={v.tekst_na_koniec} onChange={(e) => set("tekst_na_koniec", e.target.value)} className={field} />
      </label>
      <div className="md:col-span-2 flex items-center gap-4">
        <button disabled={busy} className="btn-relic !py-3">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Zapisz ustawienia</button>
        {ok && <span className="text-xs gold-text">Zapisano.</span>}
      </div>
    </form>
  );
}