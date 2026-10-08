import React, { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { pagePath } from "@/components/cms/links";
import { newBlock } from "@/components/cms/blockTypes";
import { SITE_MAP, FILTERS } from "./siteMap";
import PageRow from "./PageRow";
import { inputCls, tabBtn } from "./ui";

const slugify = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

export default function PagesList({ onOpen }) {
  const [pages, setPages] = useState(null);
  const [logs, setLogs] = useState({});
  const [filter, setFilter] = useState("wszystkie");
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const load = () => base44.entities.SitePage.filter({}, { sort: "tytul", limit: 200 }).then((p) => setPages(p.items));
  useEffect(() => {
    load();
    base44.entities.ContentLog.filter({}, { sort: "-created_date", limit: 200, fields: ["page_slug", "kto", "created_date"] })
      .then((r) => { const m = {}; r.items.forEach((l) => { if (!m[l.page_slug]) m[l.page_slug] = l; }); setLogs(m); });
  }, []);

  // Widoki z kodu + strony z edytora (strona z edytora zastępuje wpis z mapy o tym samym adresie).
  const rows = useMemo(() => {
    if (!pages) return [];
    const bySlug = Object.fromEntries(pages.map((p) => [p.slug, p]));
    const known = SITE_MAP.map((s) => (bySlug[s.slug] ? { ...s, cms: bySlug[s.slug], status: bySlug[s.slug].status === "opublikowana" ? s.status : bySlug[s.slug].status } : s));
    const extra = pages.filter((p) => !SITE_MAP.some((s) => s.slug === p.slug))
      .map((p) => ({ slug: p.slug, tytul: p.tytul, path: pagePath(p.slug), status: p.noindex && p.status === "opublikowana" ? "ukryta" : p.status, menu: false, cms: p }));
    return [...known, ...extra];
  }, [pages]);
  const shown = rows.filter((r) => (filter === "wszystkie" || r.status === filter) && (!q || `${r.tytul} ${r.path}`.toLowerCase().includes(q.toLowerCase())));
  const count = (f) => rows.filter((r) => f === "wszystkie" || r.status === f).length;

  const create = async () => {
    const slug = slugify(name);
    if (!slug) return setErr("Podaj nazwę strony.");
    if (rows.some((p) => p.slug === slug)) return setErr("Strona o takim adresie już istnieje.");
    const hero = newBlock("hero");
    hero.dane.linia1 = name.trim();
    const p = await base44.entities.SitePage.create({ tytul: name.trim(), slug, status: "szkic", bloki: [hero], wersja: 0 });
    onOpen(p.id);
  };
  const remove = async (p) => {
    if (!window.confirm(`Usunąć szkic „${p.tytul}”? Tej operacji nie można cofnąć.`)) return;
    await base44.entities.SitePage.delete(p.id);
    load();
  };

  if (!pages) return <div className="h-48 border hairline animate-pulse bg-[#0F0F10]" />;
  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(([k, l]) => <button key={k} className={tabBtn(filter === k)} onClick={() => setFilter(k)}>{l.toUpperCase()} · {count(k)}</button>)}
        </div>
        <div className="relative lg:w-72">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
          <input className={`${inputCls} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj strony" />
        </div>
      </div>
      <div className="border hairline divide-y divide-[#3D3D3F]/60">
        {shown.map((p) => <PageRow key={p.slug} p={p} log={logs[p.slug]} onOpen={onOpen} onRemove={remove} />)}
        {!shown.length && <p className="px-5 py-8 text-foreground/50">Brak stron w tym widoku.</p>}
      </div>
      <div className="border hairline p-5">
        <p className="technical text-[10px] text-foreground/50 mb-3">NOWA STRONA</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input className={inputCls} value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} placeholder="Nazwa strony, np. Warsztaty" />
          <button onClick={create} className="btn-relic shrink-0"><Plus className="h-4 w-4" /> Utwórz</button>
        </div>
        {name && <p className="text-xs text-foreground/40 mt-2">Adres: /strona/{slugify(name)}</p>}
        {err && <p className="text-sm blood-text mt-2">{err}</p>}
      </div>
    </div>
  );
}