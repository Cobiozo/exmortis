import React from "react";
import { ArrowLeft, ExternalLink, Redo2, Undo2, Loader2 } from "lucide-react";
import { pagePath } from "@/components/cms/links";
import { smallBtn } from "./ui";

const SAVE = { zapisano: "Szkic zapisany", zapisywanie: "Zapisywanie…", niezapisane: "Zmiany — autozapis za chwilę" };

export default function EditorTopBar({ page, save, busy, onBack, onSave, onPublish, onUndo, onRedo }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-4 min-w-0">
        <button onClick={onBack} className={smallBtn}><ArrowLeft className="h-4 w-4" /> Strony</button>
        <div className="min-w-0">
          <h2 className="relic-heading text-2xl truncate">{page.tytul}</h2>
          <p className="technical text-[9px] text-foreground/40">{pagePath(page.slug)} · {SAVE[save]} · wersja {page.wersja || 0}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={onUndo} className={smallBtn} aria-label="Cofnij"><Undo2 className="h-4 w-4" /></button>
        <button onClick={onRedo} className={smallBtn} aria-label="Ponów"><Redo2 className="h-4 w-4" /></button>
        <a href={`${pagePath(page.slug)}?podglad=gosc`} target="_blank" rel="noopener noreferrer" className={smallBtn}><ExternalLink className="h-4 w-4" /> Strona publiczna</a>
        <button onClick={onSave} disabled={save === "zapisywanie"} className={smallBtn}>Zapisz szkic</button>
        <button onClick={onPublish} disabled={busy} className="btn-relic !py-2.5 !px-5 disabled:opacity-50">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Opublikuj
        </button>
      </div>
    </div>
  );
}