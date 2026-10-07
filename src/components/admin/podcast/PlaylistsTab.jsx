import React, { useEffect, useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Eye, EyeOff, Trash2, X } from "lucide-react";
import { EP, PL, inp } from "./podAdmin";

const TYP = { sezon: "Sezon", seria: "Seria tematyczna", wybor: "Wybór" };

export default function PlaylistsTab() {
  const [pls, setPls] = useState(null);
  const [eps, setEps] = useState([]);
  const [name, setName] = useState("");
  const [typ, setTyp] = useState("sezon");
  const load = () => PL.filter({}, { sort: "kolejnosc", limit: 100 }).then((p) => setPls(p.items));
  useEffect(() => { load(); EP.filter({}, { sort: "-numer", limit: 200, fields: ["numer", "tytul"] }).then((p) => setEps(p.items)); }, []);

  const save = async (p, patch) => { setPls((l) => l.map((x) => (x.id === p.id ? { ...x, ...patch } : x))); await PL.update(p.id, patch); };
  const add = async (e) => { e.preventDefault(); if (!name.trim()) return; await PL.create({ nazwa: name.trim(), typ, odcinki: [], widoczna: true, kolejnosc: pls.length }); setName(""); load(); };
  const del = async (p) => { if (window.confirm(`Usunąć playlistę „${p.nazwa}”?`)) { await PL.delete(p.id); load(); } };
  const onDrag = ({ source, destination }) => {
    if (!destination) return;
    const p = pls.find((x) => x.id === destination.droppableId);
    if (source.droppableId === "all") {
      const id = eps[source.index].id;
      if (p.odcinki?.includes(id)) return;
      const l = [...(p.odcinki || [])]; l.splice(destination.index, 0, id); return save(p, { odcinki: l });
    }
    if (source.droppableId !== destination.droppableId) return;
    const l = [...p.odcinki]; const [m] = l.splice(source.index, 1); l.splice(destination.index, 0, m); save(p, { odcinki: l });
  };
  const title = (id) => { const e = eps.find((x) => x.id === id); return e ? `#${e.numer ?? "—"} ${e.tytul}` : "(usunięty)"; };

  if (!pls) return <p className="text-sm text-foreground/50">Ładowanie…</p>;
  return (
    <DragDropContext onDragEnd={onDrag}>
      <form onSubmit={add} className="flex flex-wrap gap-3 mb-6">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nazwa, np. Sezon 1" className={`${inp} max-w-xs`} />
        <select value={typ} onChange={(e) => setTyp(e.target.value)} className="bg-black border hairline px-3 text-sm">{Object.entries(TYP).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <button className="btn-relic !py-2 !px-5">Dodaj playlistę</button>
      </form>
      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        <Droppable droppableId="all" isDropDisabled>
          {(d) => (
            <div ref={d.innerRef} {...d.droppableProps} className="border hairline p-3 space-y-1 h-fit">
              <p className="technical text-[10px] text-foreground/45 mb-2">ODCINKI — PRZECIĄGNIJ DO PLAYLISTY</p>
              {eps.map((e, i) => <Draggable key={e.id} draggableId={`all-${e.id}`} index={i}>{(x) => <div ref={x.innerRef} {...x.draggableProps} {...x.dragHandleProps} className="text-xs border hairline px-2 py-1.5 bg-[#0A0A0B]">#{e.numer ?? "—"} {e.tytul}</div>}</Draggable>)}
              {d.placeholder}
            </div>
          )}
        </Droppable>
        <div className="space-y-4">
          {!pls.length && <p className="text-sm text-foreground/45">Brak playlist.</p>}
          {pls.map((p) => (
            <div key={p.id} className="border hairline p-4">
              <div className="flex items-center gap-3 mb-3">
                <input value={p.nazwa} onChange={(e) => setPls((l) => l.map((x) => (x.id === p.id ? { ...x, nazwa: e.target.value } : x)))} onBlur={(e) => PL.update(p.id, { nazwa: e.target.value })} className="bg-transparent shop-heading text-lg flex-1" />
                <span className="text-xs text-foreground/40">{TYP[p.typ]}</span>
                <button onClick={() => save(p, { widoczna: !p.widoczna })} aria-label="Widoczność" className="text-foreground/50">{p.widoczna ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button>
                <button onClick={() => del(p)} aria-label="Usuń" className="text-foreground/40 hover:text-[#BC1E22]"><Trash2 className="h-4 w-4" /></button>
              </div>
              <Droppable droppableId={p.id}>
                {(d) => (
                  <div ref={d.innerRef} {...d.droppableProps} className="min-h-[44px] space-y-1 border border-dashed hairline p-2">
                    {(p.odcinki || []).map((id, i) => (
                      <Draggable key={id} draggableId={`${p.id}-${id}`} index={i}>{(x) => (
                        <div ref={x.innerRef} {...x.draggableProps} {...x.dragHandleProps} className="text-xs border hairline px-2 py-1.5 bg-[#0A0A0B] flex justify-between">{title(id)}
                          <button onClick={() => save(p, { odcinki: p.odcinki.filter((y) => y !== id) })} aria-label="Usuń z playlisty"><X className="h-3 w-3" /></button>
                        </div>
                      )}</Draggable>
                    ))}
                    {d.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </div>
    </DragDropContext>
  );
}