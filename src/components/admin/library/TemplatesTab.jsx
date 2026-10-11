import React, { useEffect, useState } from "react";
import { Loader2, Pencil, Trash2, Plus } from "lucide-react";
import { lib } from "./libApi";
import LibModal from "./LibModal";
import RichLite from "./RichLite";

// Szablony treści wiadomości: podgląd, użycie, edycja i usunięcie.
export default function TemplatesTab({ onUse, onChanged }) {
  const [items, setItems] = useState(null);
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  const load = () => lib("templates_list").then((d) => setItems(d.items)).catch((e) => { setErr(e.message); setItems([]); });
  useEffect(() => { load(); }, []);

  const save = async () => {
    setBusy("save"); setErr("");
    try {
      await lib("template_save", { id: edit.id, name: edit.name, title: edit.title, body_html: edit.body_html });
      setEdit(null); load(); onChanged?.();
    } catch (e) { setErr(e.message); } finally { setBusy(""); }
  };

  const remove = async () => {
    setBusy("del"); setErr("");
    try { await lib("template_delete", { id: del.id }); setDel(null); load(); }
    catch (e) { setErr(e.message); } finally { setBusy(""); }
  };

  if (!items) return <Loader2 className="h-5 w-5 animate-spin gold-text" />;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button className="btn-relic" onClick={() => setEdit({ id: null, name: "", title: "", body_html: "" })}><Plus className="h-4 w-4" /> NOWY SZABLON</button>
      </div>
      {err && <p className="text-sm blood-text">{err}</p>}
      {items.length === 0 ? <p className="text-sm text-foreground/50">Nie ma jeszcze żadnego szablonu.</p> : (
        <div className="border hairline divide-y divide-[#3D3D3F]/60">
          {items.map((t) => (
            <div key={t.id} className="p-4 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">{t.name}</p>
                {t.preview && <p className="text-xs text-foreground/40 mt-1 truncate">{t.preview}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-relic !px-3 !py-2" onClick={() => onUse(t)}>UŻYJ</button>
                <button className="btn-ghost !px-3 !py-2" onClick={() => setEdit(t)} title="Zmień"><Pencil className="h-4 w-4" /></button>
                <button className="btn-ghost !px-3 !py-2" onClick={() => setDel(t)} title="Usuń"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <LibModal
        open={!!edit} onClose={() => setEdit(null)} wide title={edit?.id ? "Szablon" : "Nowy szablon"}
        footer={<>
          <button className="btn-ghost" onClick={() => setEdit(null)}>ANULUJ</button>
          <button className="btn-relic" onClick={save} disabled={busy === "save"}>{busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : "ZAPISZ"}</button>
        </>}
      >
        <div>
          <label className="technical text-[10px] text-foreground/50 block mb-2">NAZWA</label>
          <input value={edit?.name || ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className="w-full bg-[#0A0A0B] border hairline px-3 py-2 text-sm focus:border-[#C9A24A] outline-none" />
        </div>
        <div>
          <label className="technical text-[10px] text-foreground/50 block mb-2">TYTUŁ (OPCJONALNY)</label>
          <input value={edit?.title || ""} onChange={(e) => setEdit({ ...edit, title: e.target.value })} className="w-full bg-[#0A0A0B] border hairline px-3 py-2 text-sm focus:border-[#C9A24A] outline-none" />
        </div>
        <div>
          <label className="technical text-[10px] text-foreground/50 block mb-2">TREŚĆ</label>
          <RichLite semantic token value={edit?.body_html || ""} onChange={(v) => setEdit({ ...edit, body_html: v })} placeholder="Treść szablonu…" />
        </div>
      </LibModal>

      <LibModal
        open={!!del} onClose={() => setDel(null)} title="Usunąć szablon?"
        footer={<>
          <button className="btn-ghost" onClick={() => setDel(null)}>WRÓĆ</button>
          <button className="btn-blood" onClick={remove} disabled={busy === "del"}>USUŃ</button>
        </>}
      >
        <p className="text-sm text-foreground/70">Szablon „{del?.name}" zniknie. Wysłane wiadomości zostają bez zmian.</p>
      </LibModal>
    </div>
  );
}