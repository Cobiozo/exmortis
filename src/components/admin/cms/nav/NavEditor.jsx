import React, { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useSiteNav, NAV_DEFAULT } from "@/components/exmortis/nav/useSiteNav";
import { linkError } from "@/components/cms/links";
import { inputCls, labelCls, smallBtn } from "../ui";
import LinkRows from "./LinkRows";

// Edycja górnego menu, przycisku Test i kolumn stopki.
export default function NavEditor() {
  const nav = useSiteNav();
  const qc = useQueryClient();
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { if (!d && nav.record !== undefined) setD(structuredClone({ menu: nav.menu, test: nav.test, kolumny: nav.kolumny })); }, [nav.record]);
  if (!d) return <Loader2 className="h-5 w-5 animate-spin gold-text" />;
  const setCol = (i, patch) => setD({ ...d, kolumny: d.kolumny.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const links = [...d.menu, d.test, ...d.kolumny.flatMap((c) => c.links)];
  const bad = links.some((l) => !l.label?.trim() || linkError(l.to));
  const save = async () => {
    setBusy(true);
    if (nav.record) await base44.entities.SiteNav.update(nav.record.id, d); else await base44.entities.SiteNav.create(d);
    await qc.invalidateQueries({ queryKey: ["siteNav"] });
    setBusy(false); setMsg("Zapisano. Menu i stopka są już widoczne na stronie.");
  };
  return (
    <div className="space-y-10 max-w-4xl">
      <section className="space-y-3">
        <h3 className="relic-heading text-xl">Menu górne</h3>
        <LinkRows rows={d.menu} onChange={(menu) => setD({ ...d, menu })} max={9} />
        <label className={labelCls + " pt-4"}>Wyróżniony przycisk na końcu menu</label>
        <div className="flex gap-2">
          <input className={inputCls} value={d.test.label} onChange={(e) => setD({ ...d, test: { ...d.test, label: e.target.value } })} />
          <input className={inputCls} value={d.test.to} onChange={(e) => setD({ ...d, test: { ...d.test, to: e.target.value } })} />
        </div>
      </section>
      <section className="space-y-6">
        <h3 className="relic-heading text-xl">Stopka — kolumny linków</h3>
        {d.kolumny.map((c, i) => (
          <div key={i} className="border hairline p-4 space-y-3">
            <div className="flex gap-2">
              <input className={inputCls} value={c.title} placeholder="Tytuł kolumny" onChange={(e) => setCol(i, { title: e.target.value })} />
              <button className={smallBtn} onClick={() => setD({ ...d, kolumny: d.kolumny.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></button>
            </div>
            <LinkRows rows={c.links} onChange={(l) => setCol(i, { links: l })} />
          </div>
        ))}
        {d.kolumny.length < 4 && <button className={smallBtn} onClick={() => setD({ ...d, kolumny: [...d.kolumny, { title: "Nowa kolumna", links: [] }] })}><Plus className="h-4 w-4" /> Dodaj kolumnę</button>}
      </section>
      <div className="flex flex-wrap items-center gap-3 sticky bottom-0 bg-[#0A0A0B] py-4 border-t hairline">
        <button className="btn-relic disabled:opacity-50" disabled={busy || bad} onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Zapisz i opublikuj</button>
        <button className={smallBtn} onClick={() => setD(structuredClone(NAV_DEFAULT))}>Przywróć domyślne</button>
        {bad && <span className="text-sm blood-text">Uzupełnij etykiety i popraw linki.</span>}
        {msg && !bad && <span className="text-sm gold-text">{msg}</span>}
      </div>
    </div>
  );
}