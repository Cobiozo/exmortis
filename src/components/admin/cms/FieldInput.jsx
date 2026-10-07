import React from "react";
import { Switch } from "@/components/ui/switch";
import { MODULES } from "@/components/cms/modules";
import CmsRichText from "./CmsRichText";
import ButtonsField from "./ButtonsField";
import ImageField from "./ImageField";
import ItemsField from "./ItemsField";
import { inputCls, labelCls } from "./ui";

// Jedno pole formularza bloku — rodzaj wg definicji typu.
export default function FieldInput({ f, value, onChange, extra }) {
  const len = typeof value === "string" ? value.replace(/\n/g, "").length : 0;
  const label = (
    <label className={`${labelCls} flex justify-between gap-2`}>
      <span>{f.label.toUpperCase()}</span>
      {f.max && <span className={len > f.max ? "blood-text" : ""}>{len}/{f.max}</span>}
    </label>
  );
  let input;
  if (f.typ === "text") input = <input className={inputCls} value={value || ""} onChange={(e) => onChange(e.target.value)} />;
  else if (f.typ === "textarea") input = <textarea rows={3} className={`${inputCls} py-3`} value={value || ""} onChange={(e) => onChange(e.target.value)} />;
  else if (f.typ === "number") input = <input type="number" min={f.min} max={f.max} className={inputCls} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />;
  else if (f.typ === "select") input = (
    <select className={inputCls} value={value || f.opcje[0][0]} onChange={(e) => onChange(e.target.value)}>
      {f.opcje.map(([v, l]) => <option key={v} value={v} className="bg-[#0F0F10]">{l}</option>)}
    </select>
  );
  else if (f.typ === "module") input = (
    <select className={inputCls} value={value || ""} onChange={(e) => onChange(e.target.value)}>
      {Object.entries(MODULES).map(([k, [l]]) => <option key={k} value={k} className="bg-[#0F0F10]">{l}</option>)}
    </select>
  );
  else if (f.typ === "toggle") input = <Switch checked={!!value} onCheckedChange={onChange} />;
  else if (f.typ === "rich") input = <CmsRichText value={value} onChange={onChange} />;
  else if (f.typ === "buttons") input = <ButtonsField value={value || []} onChange={onChange} max={f.maxItems} extra={extra} />;
  else if (f.typ === "image") input = <ImageField value={value} onChange={onChange} noAlt={f.noAlt} />;
  else if (f.typ === "lines") input = <textarea rows={8} className={`${inputCls} py-3`} value={(value || []).join("\n")} onChange={(e) => onChange(e.target.value.split("\n"))} placeholder="Jedno zdanie w linii" />;
  else if (f.typ === "items") input = <ItemsField f={f} value={value || []} onChange={onChange} extra={extra} />;
  return <div>{label}{input}</div>;
}