import React, { useEffect, useState } from "react";
import { lib, inputCls } from "./libApi";
import ClientPicker from "./ClientPicker";

export const EMPTY_TARGET = {
  kind: "osoba", emails: [], group_id: "", group_mode: "OBECNI_I_PRZYSZLI",
  exceptions_add: [], exceptions_drop: [],
};

// Jedno okno wyboru odbiorców — to samo przy przydziale materiału i przy wiadomości.
export default function TargetPicker({ value, onChange, groups }) {
  const [list, setList] = useState(groups || null);

  useEffect(() => {
    if (groups) { setList(groups); return; }
    lib("groups_list").then((d) => setList(d.items)).catch(() => setList([]));
  }, [groups]);

  const set = (k, v) => onChange({ ...value, [k]: v });

  return (
    <>
      <div className="flex gap-2">
        {[["osoba", "Osoby"], ["grupa", "Grupy"]].map(([k, l]) => (
          <button key={k} type="button" onClick={() => set("kind", k)}
            className={`px-3 py-2 technical text-[10px] border hairline ${value.kind === k ? "bg-[#C9A24A] text-[#0A0A0B]" : "text-foreground/60 hover:gold-text"}`}>{l}</button>
        ))}
      </div>

      {value.kind === "osoba" ? (
        <ClientPicker value={value.emails} onChange={(v) => set("emails", v)} />
      ) : (
        <div className="space-y-3">
          <div>
            <label className="technical text-[10px] text-foreground/50 block mb-2">GRUPA</label>
            <select value={value.group_id} onChange={(e) => set("group_id", e.target.value)} className={inputCls}>
              <option value="">— wybierz —</option>
              {(list || []).map((g) => <option key={g.id} value={g.id}>{g.name}{g.kind === "AUTOMATYCZNA" ? " (automatyczna)" : ""}</option>)}
            </select>
          </div>
          <div>
            <label className="technical text-[10px] text-foreground/50 block mb-2">KTO WCHODZI W GRĘ</label>
            <div className="flex flex-wrap gap-2">
              {[["OBECNI_I_PRZYSZLI", "Obecni i przyszli"], ["TYLKO_OBECNI", "Tylko obecni"]].map(([k, l]) => (
                <button key={k} type="button" onClick={() => set("group_mode", k)}
                  className={`px-3 py-2 technical text-[10px] border hairline ${value.group_mode === k ? "bg-[#C9A24A] text-[#0A0A0B]" : "text-foreground/60 hover:gold-text"}`}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="technical text-[10px] text-foreground/50 block mb-2">DODAJ SPOZA GRUPY</label>
            <ClientPicker value={value.exceptions_add} onChange={(v) => set("exceptions_add", v)} />
          </div>
          <div>
            <label className="technical text-[10px] text-foreground/50 block mb-2">WYKLUCZ Z GRUPY</label>
            <ClientPicker value={value.exceptions_drop} onChange={(v) => set("exceptions_drop", v)} />
          </div>
        </div>
      )}
    </>
  );
}