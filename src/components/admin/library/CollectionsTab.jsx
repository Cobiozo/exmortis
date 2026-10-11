import React, { useEffect, useState } from "react";
import { Loader2, Plus, Pencil, Trash2, Send } from "lucide-react";
import { lib } from "./libApi";
import LibModal from "./LibModal";
import CollectionForm from "./CollectionForm";
import AssignDialog from "./AssignDialog";

export default function CollectionsTab() {
  const [items, setItems] = useState(null);
  const [form, setForm] = useState(null);
  const [assign, setAssign] = useState(null);
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = () => {
    setErr("");
    lib("collections_list").then((d) => setItems(d.items)).catch((e) => { setErr(e.message); setItems([]); });
  };
  useEffect(() => { load(); }, []);

  const doDelete = async () => {
    setBusy(true);
    try { await lib("collection_delete", { id: del.id }); setDel(null); load(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button className="btn-relic" onClick={() => setForm({ item: null })}><Plus className="h-4 w-4" /> NOWA KOLEKCJA</button>
      </div>

      {err && <p className="text-sm blood-text">{err}</p>}

      {!items ? <Loader2 className="h-5 w-5 animate-spin gold-text" /> : items.length === 0 ? (
        <p className="text-sm text-foreground/50">Nie ma jeszcze żadnej kolekcji.</p>
      ) : (
        <div className="space-y-3">
          {items.map((c) => (
            <div key={c.id} className="p-4 border hairline space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{c.title}</p>
                  {c.description && <p className="text-xs text-foreground/45 mt-1">{c.description}</p>}
                  <p className="text-[11px] text-foreground/40 mt-1">{(c.items || []).filter((i) => i.material_id).length} materiałów</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setAssign(c)} className="btn-ghost !px-3 !py-2" title="Przydziel"><Send className="h-4 w-4" /></button>
                  <button onClick={() => setForm({ item: c })} className="btn-ghost !px-3 !py-2" title="Edytuj"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => setDel(c)} className="btn-ghost !px-3 !py-2" title="Usuń"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {form && <CollectionForm open onClose={() => setForm(null)} item={form.item} onDone={() => { setForm(null); load(); }} />}
      {assign && <AssignDialog open onClose={() => setAssign(null)} collectionId={assign.id} label={`Kolekcja: ${assign.title}`} onDone={load} />}

      <LibModal open={!!del} onClose={() => setDel(null)} title="Usunąć kolekcję?"
        footer={<>
          <button className="btn-ghost" onClick={() => setDel(null)}>ANULUJ</button>
          <button className="btn-blood" onClick={doDelete} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "USUŃ"}</button>
        </>}>
        <p className="text-sm text-foreground/70">Kolekcja „{del?.title}" zostanie usunięta wraz z przydziałami. Same materiały zostaną w bibliotece.</p>
      </LibModal>
    </div>
  );
}