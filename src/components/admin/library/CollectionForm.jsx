import React, { useEffect, useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { ArrowUp, ArrowDown, X, GripVertical, Plus, Loader2 } from "lucide-react";
import { lib, inputCls, KIND_LABEL } from "./libApi";
import LibModal from "./LibModal";

// Kolekcja: tytuł, opis i uporządkowana lista materiałów (przeciąganie oraz strzałki — na telefonie).
export default function CollectionForm({ open, onClose, item, onDone }) {
  const [f, setF] = useState(() => ({ id: item?.id || null, title: item?.title || "", description: item?.description || "", items: [] }));
  const [all, setAll] = useState([]);
  const [pick, setPick] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    lib("materials_list", {}).then((d) => setAll(d.items)).catch(() => setAll([]));
  }, []);

  useEffect(() => {
    if (!item?.id) return;
    setF((x) => ({
      ...x,
      items: (item.items || []).filter((i) => i.material_id).map((i) => ({ material_id: i.material_id, title: i.title || "—", kind: i.kind })),
    }));
  }, [item]);

  const move = (from, to) => {
    if (to < 0 || to >= f.items.length) return;
    const next = [...f.items];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    setF((v) => ({ ...v, items: next }));
  };

  const add = (m) => {
    if (f.items.some((i) => i.material_id === m.id)) return;
    setF((v) => ({ ...v, items: [...v.items, { material_id: m.id, title: m.title, kind: m.kind }] }));
  };

  const save = async () => {
    setErr(""); setBusy(true);
    try {
      await lib("collection_save", {
        id: f.id, title: f.title, description: f.description,
        items: f.items.map((i, n) => ({ material_id: i.material_id, position: n })),
      });
      onDone();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <LibModal
      open={open} onClose={onClose} wide title={item ? "Edytuj kolekcję" : "Nowa kolekcja"}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>ANULUJ</button>
          <button className="btn-relic" onClick={save} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "ZAPISZ"}</button>
        </>
      }
    >
      <div>
        <label className="technical text-[10px] text-foreground/50 block mb-2">TYTUŁ</label>
        <input value={f.title} onChange={(e) => setF((v) => ({ ...v, title: e.target.value }))} className={inputCls} />
      </div>
      <div>
        <label className="technical text-[10px] text-foreground/50 block mb-2">OPIS</label>
        <textarea value={f.description} onChange={(e) => setF((v) => ({ ...v, description: e.target.value }))} rows={2} className={inputCls} />
      </div>

      <div className="flex items-center justify-between gap-3">
        <label className="technical text-[10px] text-foreground/50">MATERIAŁY ({f.items.length})</label>
        <button className="btn-ghost !px-3 !py-2" onClick={() => setPick(true)}><Plus className="h-4 w-4" /> DODAJ</button>
      </div>

      {f.items.length === 0 ? (
        <p className="text-sm text-foreground/45">Kolekcja jest pusta.</p>
      ) : (
        <DragDropContext onDragEnd={(r) => { if (r.destination) move(r.source.index, r.destination.index); }}>
          <Droppable droppableId="col">
            {(drop) => (
              <div ref={drop.innerRef} className="border hairline divide-y divide-[#3D3D3F]/60">
                {f.items.map((it, i) => (
                  <Draggable key={it.material_id} draggableId={it.material_id} index={i}>
                    {(drag) => (
                      <div ref={drag.innerRef} {...drag.draggableProps} className="p-3 flex items-center gap-3">
                        <span {...drag.dragHandleProps} className="text-foreground/30 cursor-grab"><GripVertical className="h-4 w-4" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm truncate">{it.title}</span>
                          <span className="block text-[11px] text-foreground/40">{KIND_LABEL[it.kind]}</span>
                        </span>
                        <button onClick={() => move(i, i - 1)} className="btn-ghost !px-2 !py-1" title="W górę"><ArrowUp className="h-4 w-4" /></button>
                        <button onClick={() => move(i, i + 1)} className="btn-ghost !px-2 !py-1" title="W dół"><ArrowDown className="h-4 w-4" /></button>
                        <button onClick={() => setF((v) => ({ ...v, items: v.items.filter((x) => x.material_id !== it.material_id) }))}
                          className="btn-ghost !px-2 !py-1" title="Usuń z kolekcji"><X className="h-4 w-4" /></button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {drop.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {err && <p className="text-sm blood-text">{err}</p>}

      <LibModal open={pick} onClose={() => setPick(false)} title="Dodaj materiał">
        {all.length === 0 ? <p className="text-sm text-foreground/45">Brak materiałów w bibliotece.</p> : (
          <div className="border hairline divide-y divide-[#3D3D3F]/60 max-h-80 overflow-y-auto">
            {all.map((m) => (
              <button key={m.id} onClick={() => add(m)} disabled={f.items.some((i) => i.material_id === m.id)}
                className="w-full text-left px-3 py-2 hover:bg-[#0F0F10] disabled:opacity-40 flex justify-between gap-3">
                <span className="text-sm truncate">{m.title}</span>
                <span className="technical text-[10px] gold-text">{KIND_LABEL[m.kind]}</span>
              </button>
            ))}
          </div>
        )}
      </LibModal>
    </LibModal>
  );
}