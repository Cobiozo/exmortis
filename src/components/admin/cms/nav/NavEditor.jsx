import React, { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useSiteNav, NAV_DEFAULT } from "@/components/exmortis/nav/useSiteNav";
import { linkError } from "@/components/cms/links";
import { inputCls, labelCls, smallBtn } from "../ui";
import LinkRows from "./LinkRows";
import NavVersions from "./NavVersions";
import NavPreview from "./NavPreview";

// Menu i stopka: szkic z autozapisem, publikacja z zapisem wersji.
export default function NavEditor() {
  const nav = useSiteNav();
  const qc = useQueryClient();
  const [d, setD] = useState(null);
  const [rec, setRec] = useState(null);
  const [state, setState] = useState("");
  const [ver, setVer] = useState(0);
  const timer = useRef(null);
  useEffect(() => {
    if (d || nav.record === undefined) return;
    setRec(nav.record);
    setD(structuredClone(nav.record?.szkic || { menu: nav.menu, test: nav.test, kolumny: nav.kolumny }));
    if (nav.record?.zmiany_niezapisane) setState("szkic");
  }, [nav.record]);

  const persist = async (patch) => {
    const r = rec ? await base44.entities.SiteNav.update(rec.id, patch) : await base44.entities.SiteNav.create(patch);
    setRec(r); return r;
  };
  const edit = (next) => {
    setD(next); setState("zapisywanie");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => { await persist({ szkic: next, zmiany_niezapisane: true }); setState("szkic"); }, 800);
  };
  if (!d) return <Loader2 className="h-5 w-5 animate-spin gold-text" />;

  const setCol = (i, patch) => edit({ ...d, kolumny: d.kolumny.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const bad = [...d.menu, d.test, ...d.kolumny.flatMap((c) => c.links)].some((l) => !l.label?.trim() || linkError(l.to));
  const publish = async () => {
    clearTimeout(timer.current); setState("publikowanie");
    const me = await base44.auth.me().catch(() => null);
    const wersja = (rec?.wersja || 0) + 1;
    await persist({ ...d, szkic: d, zmiany_niezapisane: false, wersja, opublikowano_at: new Date().toISOString() });
    await base44.entities.PageVersion.create({ slug: "_menu", wersja, tytul: "Menu i stopka", bloki: [d], kto: me?.email || "" });
    await qc.invalidateQueries({ queryKey: ["siteNav"] });
    setVer((v) => v + 1); setState("opublikowano");
  };
  const label = { zapisywanie: "Zapisywanie szkicu…", szkic: "Szkic zapisany · nieopublikowane zmiany", publikowanie: "Publikowanie…", opublikowano: `Opublikowano wersję ${rec?.wersja}` }[state];

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_400px] gap-8 items-start">
    <div className="space-y-10 min-w-0">
      <section className="space-y-3">
        <h3 className="relic-heading text-xl">Menu górne</h3>
        <LinkRows rows={d.menu} onChange={(menu) => edit({ ...d, menu })} max={9} />
        <label className={labelCls + " pt-4"}>Wyróżniony przycisk na końcu menu</label>
        <div className="flex gap-2">
          <input className={inputCls} value={d.test.label} onChange={(e) => edit({ ...d, test: { ...d.test, label: e.target.value } })} />
          <input className={inputCls} value={d.test.to} onChange={(e) => edit({ ...d, test: { ...d.test, to: e.target.value } })} />
        </div>
      </section>
      <section className="space-y-6">
        <h3 className="relic-heading text-xl">Stopka — kolumny linków</h3>
        {d.kolumny.map((c, i) => (
          <div key={i} className="border hairline p-4 space-y-3">
            <div className="flex gap-2">
              <input className={inputCls} value={c.title} placeholder="Tytuł kolumny" onChange={(e) => setCol(i, { title: e.target.value })} />
              <button className={smallBtn} onClick={() => edit({ ...d, kolumny: d.kolumny.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></button>
            </div>
            <LinkRows rows={c.links} onChange={(l) => setCol(i, { links: l })} />
          </div>
        ))}
        {d.kolumny.length < 4 && <button className={smallBtn} onClick={() => edit({ ...d, kolumny: [...d.kolumny, { title: "Nowa kolumna", links: [] }] })}><Plus className="h-4 w-4" /> Dodaj kolumnę</button>}
      </section>
      <NavVersions refresh={ver} onLoad={(v) => v && edit(structuredClone(v))} />
      <div className="flex flex-wrap items-center gap-3 sticky bottom-0 bg-[#0A0A0B] py-4 border-t hairline">
        <button className="btn-relic disabled:opacity-50" disabled={bad || state === "publikowanie"} onClick={publish}>
          {state === "publikowanie" && <Loader2 className="h-4 w-4 animate-spin" />} Opublikuj
        </button>
        <button className={smallBtn} onClick={() => edit(structuredClone(NAV_DEFAULT))}>Przywróć domyślne</button>
        {bad ? <span className="text-sm blood-text">Uzupełnij etykiety i popraw linki.</span>
          : label && <span className="technical text-[10px] text-foreground/60">{label}</span>}
      </div>
    </div>
    <div className="lg:sticky lg:top-4 lg:max-h-[90vh] lg:overflow-y-auto"><NavPreview d={d} /></div>
    </div>
  );
}