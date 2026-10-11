import React, { useEffect, useState } from "react";
import { Loader2, Plus, Pencil, Trash2, Users } from "lucide-react";
import { lib } from "./libApi";
import LibModal from "./LibModal";
import GroupForm from "./GroupForm";
import GroupPanel from "./GroupPanel";
// Rozwinięcie grupy pokazuje jej kartę: członków, materiały i wiadomości.
import MessageForm from "./MessageForm";
import AssignDialog from "./AssignDialog";

export default function GroupsTab() {
  const [items, setItems] = useState(null);
  const [form, setForm] = useState(null);
  const [del, setDel] = useState(null);
  const [open, setOpen] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [write, setWrite] = useState(null);
  const [assign, setAssign] = useState(null);

  const load = () => {
    setErr("");
    lib("groups_list").then((d) => setItems(d.items)).catch((e) => { setErr(e.message); setItems([]); });
  };
  useEffect(() => { load(); }, []);

  const accept = async (g) => {
    setBusy(g.id);
    try { await lib("group_accept", { id: g.id }); load(); }
    catch (e) { setErr(e.message); } finally { setBusy(""); }
  };

  const doDelete = async (materials) => {
    setBusy("del");
    try { await lib("group_delete", { id: del.id, materials }); setDel(null); load(); }
    catch (e) { setErr(e.message); } finally { setBusy(""); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button className="btn-relic" onClick={() => setForm({ item: null })}><Plus className="h-4 w-4" /> NOWA GRUPA</button>
      </div>

      {err && <p className="text-sm blood-text">{err}</p>}

      {!items ? <Loader2 className="h-5 w-5 animate-spin gold-text" /> : items.length === 0 ? (
        <p className="text-sm text-foreground/50">Nie ma jeszcze żadnej grupy.</p>
      ) : (
        <div className="space-y-3">
          {items.map((g) => {
            const starter = !g.accepted_at && g.kind === "RECZNA";
            const auto = g.kind === "AUTOMATYCZNA";
            return (
              <div key={g.id} className="p-4 border hairline space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="h-3 w-3 border border-[#3D3D3F]" style={{ background: g.color || "#3D3D3F" }} />
                      <p className="text-sm">{g.name}</p>
                      {auto && <span className="technical text-[10px] gold-text">AUTOMATYCZNA</span>}
                      {starter && <span className="technical text-[10px] blood-text">DO AKCEPTACJI</span>}
                    </div>
                    {g.description && <p className="text-xs text-foreground/45 mt-1">{g.description}</p>}
                    <p className="text-[11px] text-foreground/40 mt-1">
                      {auto ? `Osób teraz: ${g.count}` : `Członków: ${g.count}`}
                      {auto && g.rule?.typ === "aktywny_pakiet" ? " · aktywny pakiet" : ""}
                      {auto && g.rule?.typ === "produkt" ? " · kupił produkt" : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setOpen(open === g.id ? "" : g.id)} className="btn-ghost !px-3 !py-2" title="Karta grupy">
                      <Users className="h-4 w-4" />
                    </button>
                    {starter && (
                      <button onClick={() => accept(g)} className="btn-relic !px-3 !py-2" disabled={busy === g.id}>ZOSTAW</button>
                    )}
                    {!auto && (
                      <button onClick={() => setForm({ item: g })} className="btn-ghost !px-3 !py-2" title="Zmień nazwę"><Pencil className="h-4 w-4" /></button>
                    )}
                    <button onClick={() => setDel(g)} className="btn-ghost !px-3 !py-2" title="Usuń"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                {open === g.id && <GroupPanel group={g} onWrite={setWrite} onAssign={setAssign} />}
              </div>
            );
          })}
        </div>
      )}

      {form && <GroupForm open onClose={() => setForm(null)} item={form.item} onDone={() => { setForm(null); load(); }} />}

      {write && (
        <MessageForm open onClose={() => setWrite(null)}
          presetTarget={{ kind: "grupa", emails: [], group_id: write.id, group_mode: "OBECNI_I_PRZYSZLI", exceptions_add: [], exceptions_drop: [] }}
          onDone={() => { setWrite(null); load(); }} />
      )}
      {assign && (
        <AssignDialog open onClose={() => setAssign(null)} presetGroupId={assign.id}
          label={`Grupa: ${assign.name}`} onDone={() => { setAssign(null); load(); }} />
      )}

      <LibModal
        open={!!del} onClose={() => setDel(null)} title="Usunąć grupę?"
        footer={<>
          <button className="btn-ghost" onClick={() => setDel(null)}>ANULUJ</button>
          <button className="btn-ghost" onClick={() => doDelete("zostaw")} disabled={busy === "del"}>ZOSTAW INDYWIDUALNIE</button>
          <button className="btn-blood" onClick={() => doDelete("odbierz")} disabled={busy === "del"}>ODEBIERZ MATERIAŁY</button>
        </>}
      >
        <p className="text-sm text-foreground/70">Grupa „{del?.name}" zniknie. Co zrobić z materiałami, które miała przydzielone?</p>
        <p className="text-xs text-foreground/45">
          „Odbierz materiały" — członkowie tracą dostęp. „Zostaw indywidualnie" — każdy zachowuje dostęp nadany wprost.
        </p>
      </LibModal>
    </div>
  );
}