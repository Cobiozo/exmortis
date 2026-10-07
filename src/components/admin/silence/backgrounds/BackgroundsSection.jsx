import React, { useEffect, useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { base44 } from "@/api/base44Client";
import BackgroundRow from "./BackgroundRow";
import BackgroundEditor, { loadTrackNames } from "./BackgroundEditor";

const E = base44.entities.SilenceBackground;
const NEW = { nazwa: "", typ: "zdjecie", przyciemnienie: 55, rozmycie: 0, fokus_x: 50, fokus_y: 50, kolor: "#0A0A0A", kolory: ["#0A0A0A", "#1A1410"], kierunek: 180, aktywne: true };

export default function BackgroundsSection() {
  const [list, setList] = useState([]);
  const [edit, setEdit] = useState(null);
  const [names, setNames] = useState([]);

  const load = () => E.filter({}, { sort: "kolejnosc", limit: 100 }).then((p) => setList(p.items));
  useEffect(() => { load(); loadTrackNames().then(setNames); }, []);

  const sys = list.filter((b) => b.systemowe);
  const rest = list.filter((b) => !b.systemowe);

  const clearDefaults = (keep) =>
    Promise.all(list.filter((b) => b.domyslne && b.id !== keep).map((b) => E.update(b.id, { domyslne: false })));

  const save = async ({ id, created_date, updated_date, created_by_id, ...data }) => {
    const rec = id ? await E.update(id, data) : await E.create({ ...data, kolejnosc: rest.length + 1 });
    if (data.domyslne) await clearDefaults(rec.id || id);
    setEdit(null); load();
  };
  const setDefault = async (b) => { await clearDefaults(b.id); await E.update(b.id, { domyslne: true }); load(); };
  const toggle = async (b) => { await E.update(b.id, { aktywne: !b.aktywne }); load(); };
  const remove = async (b) => { if (window.confirm(`Usunąć tło „${b.nazwa}”?`)) { await E.delete(b.id); load(); } };

  const onDragEnd = async ({ source, destination }) => {
    if (!destination) return;
    const arr = [...rest];
    const [m] = arr.splice(source.index, 1);
    arr.splice(destination.index, 0, m);
    setList([...sys, ...arr]);
    await E.bulkUpdate(arr.map((b, i) => ({ id: b.id, kolejnosc: i + 1 })));
  };

  const row = (b, drag) => (
    <BackgroundRow bg={b} drag={drag} onToggle={() => toggle(b)} onDefault={() => setDefault(b)} onEdit={() => setEdit(b)} onDelete={() => remove(b)} />
  );

  return (
    <section className="mt-12">
      <div className="flex items-center justify-between mb-4">
        <h2 className="relic-heading text-xl">Tła</h2>
        {!edit && <button onClick={() => setEdit(NEW)} className="btn-ghost !py-2 !px-4">Dodaj tło</button>}
      </div>
      {edit && <div className="mb-6"><BackgroundEditor key={edit.id || "new"} initial={edit} trackNames={names} onSave={save} onCancel={() => setEdit(null)} /></div>}
      <div className="space-y-2">
        {sys.map((b) => <div key={b.id}>{row(b, null)}</div>)}
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="tla">
            {(p) => (
              <div ref={p.innerRef} {...p.droppableProps} className="space-y-2">
                {rest.map((b, i) => (
                  <Draggable key={b.id} draggableId={b.id} index={i}>
                    {(d) => <div ref={d.innerRef} {...d.draggableProps}>{row(b, d.dragHandleProps)}</div>}
                  </Draggable>
                ))}
                {p.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>
    </section>
  );
}