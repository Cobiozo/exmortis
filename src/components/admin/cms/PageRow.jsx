import React from "react";
import { Link } from "react-router-dom";
import { Trash2, ExternalLink, FileText, Copy } from "lucide-react";
import SafeImg from "@/components/cms/SafeImg";
import { STATUS_LABEL } from "./siteMap";
import { smallBtn } from "./ui";

const when = (d) => (d ? new Date(d).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", dateStyle: "short", timeStyle: "short" }) : "—");

// Jeden wiersz listy stron: miniatura, nazwa, adres, status, menu, ostatnia zmiana i akcje.
export default function PageRow({ p, log, onOpen, onRemove, onDuplicate, onRename }) {
  const thumb = p.cms?.bloki?.find((b) => b.dane?.tlo?.url || b.dane?.zdjecie?.url)?.dane;
  const img = thumb?.tlo || thumb?.zdjecie;
  const gold = p.status === "opublikowana";
  const editable = p.cms || p.gotowa;
  return (
    <div className="flex flex-wrap items-center gap-4 px-5 py-4">
      <div className="w-20 h-12 shrink-0 bg-[#0F0F10] border hairline flex items-center justify-center overflow-hidden">
        {img ? <SafeImg img={img} sizes="80px" className="w-full h-full" /> : <FileText className="h-4 w-4 text-foreground/30" />}
      </div>
      <div className="flex-1 min-w-[220px]">
        <button onClick={() => editable && onOpen(p)} disabled={!editable} className="block relic-heading text-lg text-left enabled:hover:text-[#C9A24A]">{p.tytul}</button>
        <span className="technical text-[9px] text-foreground/40">
          {p.path} · {p.menu ? "w menu" : "poza menu"} · zmiana {when(log?.created_date || p.cms?.updated_date)}{log?.kto ? ` · ${log.kto}` : ""}
        </span>
        {!editable && <span className="block text-xs text-foreground/40 mt-1">{p.zrodlo} · edytowalne ~{p.procent}% · przeniesienie do edytora: etap {p.etap}</span>}
      </div>
      <span className={`technical text-[9px] px-2 py-1 border ${gold ? "border-[#C9A24A] gold-text" : p.status === "ukryta" ? "border-[#BC1E22]/60 text-foreground/70" : "hairline text-foreground/50"}`}>
        {STATUS_LABEL[p.status]}{p.cms?.zmiany_niezapisane && gold ? " · szkic zmian" : ""}
      </span>
      <div className="flex flex-wrap gap-2">
        {editable && <button onClick={() => onOpen(p)} className={smallBtn}>Edytuj</button>}
        {p.cms && p.status !== "szablon" && <button onClick={() => onDuplicate(p.cms)} className={smallBtn} aria-label="Duplikuj stronę"><Copy className="h-4 w-4" /></button>}
        {p.cms && onRename && <button onClick={() => onRename(p.cms)} className={smallBtn}>Zmień adres</button>}
        {p.modul && <Link to={p.modul} className={smallBtn}>Edytuj w module</Link>}
        {!p.path.includes("…") && <a href={p.path} target="_blank" rel="noreferrer" className={smallBtn} aria-label="Zobacz na stronie"><ExternalLink className="h-4 w-4" /></a>}
        {p.cms && p.status === "szkic" && !p.cms.wersja && <button onClick={() => onRemove(p.cms)} className={smallBtn} aria-label="Usuń"><Trash2 className="h-4 w-4" /></button>}
      </div>
    </div>
  );
}