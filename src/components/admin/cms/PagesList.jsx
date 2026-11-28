import React, { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { pagePath } from "@/components/cms/links";
import { newBlock } from "@/components/cms/blockTypes";
import { SITE_MAP, FILTERS } from "./siteMap";
import { PAGE_DEFAULTS } from "@/components/cms/defaults/otherDefaults";
import PageRow from "./PageRow";
import { inputCls } from "./ui";
import { confirmDialog } from "@/components/admin/ui/confirmDialog";

import { slugify, duplicatePage, renamePage } from "./pageActions";
import { FilterChips, SearchField, SkeletonList } from "@/components/admin/ui/kit";

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
    const known = SITE_MAP.map((s) => (bySlug[s.slug] ? { ...s, cms: bySlug[s.slug], status: bySlug[s.slug].status === "opublikowana" ? s.status : bySlug[s.slug].status } : { ...s, gotowa: !!PAGE_DEFAULTS[s.slug] }));
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
  // Strona przeniesiona z kodu: pierwszy „Edytuj” zakłada jej zapis w edytorze z obecną treścią.
  const openRow = async (row) => {
    if (row.cms) return onOpen(row.cms.id);
    const p = await base44.entities.SitePage.create({ tytul: row.tytul, slug: row.slug, status: "opublikowana", bloki: PAGE_DEFAULTS[row.slug], wersja: 0 });
    onOpen(p.id);
  };
  const taken = rows.map((r) => r.slug);
  const duplicate = async (p) => { const c = await duplicatePage(p, taken); if (c) load(); };
  const rename = async (p) => { if (await renamePage(p, taken)) load(); };
  const remove = async (p) => {
    if (!(await confirmDialog(`Usunąć szkic „${p.tytul}”? Tej operacji nie można cofnąć.`))) return;
    await base44.entities.SitePage.delete(p.id);
    load();
  };

  if (!pages) return <SkeletonList rows={5} h="h-14" />;
  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
        <FilterChips items={FILTERS.map(([k, l]) => [k, l, count(k)])} value={filter} onChange={setFilter} label="Widok stron" />
        <SearchField value={q} onChange={setQ} placeholder="Szukaj strony" className="lg:w-72" />
      </div>
      <div className="border hairline divide-y divide-[#3D3D3F]/60">
        {shown.map((p) => <PageRow key={p.slug} p={p} log={logs[p.slug]} onOpen={openRow} onRemove={remove} onDuplicate={duplicate}
          onRename={!SITE_MAP.some((s) => s.slug === p.slug) ? rename : null} />)}
        {!shown.length && <p className="px-6 py-10 text-center text-sm text-foreground/55">Brak stron w tym widoku.</p>}
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