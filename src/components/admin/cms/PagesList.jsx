import React, { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { pagePath } from "@/components/cms/links";
import { newBlock } from "@/components/cms/blockTypes";
import { inputCls, smallBtn } from "./ui";

const STATUS = { szkic: "Szkic", opublikowana: "Opublikowana", zaplanowana: "Zaplanowana" };
const slugify = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

export default function PagesList({ onOpen }) {
  const [pages, setPages] = useState(null);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const load = () => base44.entities.SitePage.filter({}, { sort: "tytul", limit: 100 }).then((p) => setPages(p.items));
  useEffect(() => { load(); }, []);

  const create = async () => {
    const slug = slugify(name);
    if (!slug) return setErr("Podaj nazwę strony.");
    if (pages.some((p) => p.slug === slug)) return setErr("Strona o takim adresie już istnieje.");
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
    <div className="space-y-8">
      <div className="border hairline divide-y divide-[#3D3D3F]/60">
        {pages.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
            <button onClick={() => onOpen(p.id)} className="flex-1 min-w-[200px] text-left">
              <span className="block relic-heading text-lg hover:text-[#C9A24A]">{p.tytul}</span>
              <span className="technical text-[9px] text-foreground/40">{pagePath(p.slug)} · zmiana {new Date(p.updated_date).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })}</span>
            </button>
            <span className={`technical text-[9px] px-2 py-1 border ${p.status === "opublikowana" ? "border-[#C9A24A] gold-text" : "hairline text-foreground/50"}`}>
              {STATUS[p.status]}{p.zmiany_niezapisane && p.status === "opublikowana" ? " · szkic zmian" : ""}
            </span>
            <button onClick={() => onOpen(p.id)} className={smallBtn}>Edytuj</button>
            {p.status === "szkic" && !p.wersja && <button onClick={() => remove(p)} className={smallBtn} aria-label="Usuń"><Trash2 className="h-4 w-4" /></button>}
          </div>
        ))}
        {!pages.length && <p className="px-5 py-8 text-foreground/50">Brak stron.</p>}
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