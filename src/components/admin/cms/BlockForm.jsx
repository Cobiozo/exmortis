import React, { useState } from "react";
import { X } from "lucide-react";
import { TYPES } from "@/components/cms/blockTypes";
import { MODULE_FIELDS } from "@/components/cms/moduleFields";
import FieldInput from "./FieldInput";
import LayoutFields from "./LayoutFields";
import { tabBtn } from "./ui";

// Panel edycji jednego bloku: Treść / Układ.
export default function BlockForm({ block, onChange, onClose, extra }) {
  const [tab, setTab] = useState("tresc");
  const t = TYPES[block.typ];
  const setD = (k, v) => onChange({ ...block, dane: { ...block.dane, [k]: v } });
  // Moduł dynamiczny: wybór modułu + jego własne pola (moduleFields.js). Skarbiec ma pola z typu bloku.
  const modFields = block.typ === "modul" ? MODULE_FIELDS[block.dane.modul] : null;
  const fields = block.typ !== "modul" || block.dane.modul === "skarbiec"
    ? t.fields
    : modFields ? [t.fields[0], ...modFields] : t.fields.slice(0, 1);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3"><t.icon className="h-5 w-5 gold-text" /><h3 className="relic-heading text-xl">{t.label}</h3></div>
        <button onClick={onClose} aria-label="Zamknij" className="text-foreground/50 hover:text-foreground"><X className="h-5 w-5" /></button>
      </div>
      <div className="flex gap-2">
        <button className={tabBtn(tab === "tresc")} onClick={() => setTab("tresc")}>TREŚĆ</button>
        <button className={tabBtn(tab === "uklad")} onClick={() => setTab("uklad")}>UKŁAD</button>
      </div>
      {tab === "tresc" ? (
        <div className="space-y-5">
          {fields.map((f) => <FieldInput key={f.k} f={f} value={block.dane[f.k]} onChange={(v) => setD(f.k, v)} extra={extra} />)}
          {block.typ === "modul" && block.dane.modul !== "skarbiec" && !modFields && (
            <p className="text-sm text-foreground/50">Treść tego modułu edytujesz w jego zakładce panelu albo w „Teksty sekcji”.</p>
          )}
        </div>
      ) : <LayoutFields u={block.uklad || {}} bare={t.bare} onChange={(u) => onChange({ ...block, uklad: u })} />}
    </div>
  );
}