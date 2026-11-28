import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { lib, inputCls, KINDS, KIND_LABEL } from "./libApi";
import SpaceBar from "./SpaceBar";
import MaterialRow from "./MaterialRow";
import MaterialForm from "./MaterialForm";
import AssignDialog from "./AssignDialog";
import { SkeletonList, EmptyState } from "@/components/admin/ui/kit";

export default function MaterialsTab() {
  const [items, setItems] = useState(null);
  const [space, setSpace] = useState(null);
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [form, setForm] = useState(null);      // { item } — null = zamknięte
  const [assign, setAssign] = useState(null);  // material do przydziału
  const [sel, setSel] = useState(() => new Set()); // zaznaczone do przydziału zbiorczego
  const [assignMany, setAssignMany] = useState(null); // lista id zamrożona przy otwarciu okna
  const toggle = (id) => setSel((s0) => { const n = new Set(s0); if (n.has(id)) n.delete(id); else n.add(id); return n; });

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
        <button className="btn-relic" onClick={() => setForm({ item: null })}><Plus className="h-4 w-4" /> Dodaj materiał</button>
      </div>

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj w tytule i opisie" className={inputCls} />

      {sel.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 border hairline bg-[#0A0A0B] p-3">
          <span className="text-sm">Zaznaczone: {sel.size}</span>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost !px-3 !py-2" onClick={() => setSel(new Set())}>Wyczyść</button>
            <button className="btn-relic !px-3 !py-2" onClick={() => setAssignMany([...sel])}>Przydziel zaznaczone ({sel.size})</button>
          </div>
        </div>
      )}

      {space && <SpaceBar bytes={space.bytes} limitMb={space.limit_mb} />}
      {err && <p className="text-sm blood-text">{err}</p>}

      {!items ? (
        <SkeletonList rows={3} />
      ) : items.length === 0 ? (
        <EmptyState>Brak materiałów dla tego filtra.</EmptyState>
      ) : (
        <div className="space-y-3">
          {items.map((m) => (
            <MaterialRow key={m.id} item={m} selected={sel.has(m.id)} onSelect={() => toggle(m.id)} onEdit={(it) => setForm({ item: it })} onAssign={setAssign} onDone={load} />
          ))}
        </div>
      )}

      {form && (
        <MaterialForm open onClose={() => setForm(null)} item={form.item} onRefresh={load} onDone={() => { setForm(null); load(); }} />
      )}
      {assignMany && (
        <AssignDialog
          open
          onClose={() => setAssignMany(null)}
          materialIds={assignMany}
          label={`Materiały: ${(items || []).filter((m) => assignMany.includes(m.id)).map((m) => m.title).join(", ")}`}
          onDone={() => { setSel(new Set()); load(); }}
        />
      )}
      {assign && (
        <AssignDialog open onClose={() => setAssign(null)} materialId={assign.id} label={`Materiał: ${assign.title}`} onDone={load} />
      )}
    </div>
  );
}