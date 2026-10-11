import React, { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { lib, inputCls, KINDS, KIND_LABEL } from "./libApi";
import SpaceBar from "./SpaceBar";
import MaterialRow from "./MaterialRow";
import MaterialForm from "./MaterialForm";
import AssignDialog from "./AssignDialog";

export default function MaterialsTab() {
  const [items, setItems] = useState(null);
  const [space, setSpace] = useState(null);
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [form, setForm] = useState(null);      // { item } — null = zamknięte
  const [assign, setAssign] = useState(null);  // material do przydziału

  const load = () => {
    setErr("");
    lib("materials_list", { kind, q })
      .then((d) => { setItems(d.items); setSpace(d.przestrzen); })
      .catch((e) => { setErr(e.message); setItems([]); });
  };

  // Filtr i wyszukiwarka liczone na serwerze — każde zawężenie to nowe zapytanie.
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [kind, q]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {["", ...KINDS].map((k) => (
            <button key={k || "all"} onClick={() => setKind(k)}
              className={`px-3 py-2 technical text-[10px] border hairline ${kind === k ? "bg-[#C9A24A] text-[#0A0A0B]" : "text-foreground/60 hover:gold-text"}`}>
              {k ? KIND_LABEL[k] : "Wszystkie"}
            </button>
          ))}
        </div>
        <button className="btn-relic" onClick={() => setForm({ item: null })}><Plus className="h-4 w-4" /> DODAJ MATERIAŁ</button>
      </div>

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj w tytule i opisie" className={inputCls} />

      {space && <SpaceBar bytes={space.bytes} limitMb={space.limit_mb} />}
      {err && <p className="text-sm blood-text">{err}</p>}

      {!items ? (
        <Loader2 className="h-5 w-5 animate-spin gold-text" />
      ) : items.length === 0 ? (
        <p className="text-sm text-foreground/50">Brak materiałów dla tego filtra.</p>
      ) : (
        <div className="space-y-3">
          {items.map((m) => (
            <MaterialRow key={m.id} item={m} onEdit={(it) => setForm({ item: it })} onAssign={setAssign} onDone={load} />
          ))}
        </div>
      )}

      {form && (
        <MaterialForm open onClose={() => setForm(null)} item={form.item} onRefresh={load} onDone={() => { setForm(null); load(); }} />
      )}
      {assign && (
        <AssignDialog open onClose={() => setAssign(null)} materialId={assign.id} label={`Materiał: ${assign.title}`} onDone={load} />
      )}
    </div>
  );
}