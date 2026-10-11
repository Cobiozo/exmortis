import React, { useState } from "react";
import { Pencil, Trash2, Send, Loader2 } from "lucide-react";
import { lib, KIND_LABEL, mb1 } from "./libApi";
import LibModal from "./LibModal";

// Jeden materiał na liście. Na telefonie karta, na szerokim ekranie wiersz.
export default function MaterialRow({ item, onEdit, onAssign, onDone }) {
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const askDelete = async () => {
    setErr("");
    try { setDel(await lib("material_impact", { material_id: item.id })); }
    catch (e) { setErr(e.message); setDel({ osoby: 0, przydzialy: 0 }); }
  };

  const doDelete = async () => {
    setBusy(true);
    try { await lib("material_delete", { id: item.id }); setDel(null); onDone(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="p-4 border hairline space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="technical text-[10px] gold-text">{KIND_LABEL[item.kind]}</span>
            {item.pdf_js_warning && <span className="technical text-[10px] blood-text">PDF Z AKTYWNĄ TREŚCIĄ</span>}
            {item.file_size ? <span className="text-[11px] text-foreground/40">{mb1(item.file_size)} MB · wersja {item.file_version}</span> : null}
          </div>
          <p className="text-sm">{item.title}</p>
          {item.description && <p className="text-xs text-foreground/45 mt-1 line-clamp-2">{item.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => onAssign(item)} className="btn-ghost !px-3 !py-2" title="Przydziel"><Send className="h-4 w-4" /></button>
          <button onClick={() => onEdit(item)} className="btn-ghost !px-3 !py-2" title="Edytuj"><Pencil className="h-4 w-4" /></button>
          <button onClick={askDelete} className="btn-ghost !px-3 !py-2" title="Usuń"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 text-[11px] text-foreground/45">
        <span>Przydziały: {item.przydzialy}</span>
        <span>Otwarte: {item.otwarte}</span>
        <span>Ukończone: {item.ukonczone}</span>
      </div>
      {err && <p className="text-xs blood-text">{err}</p>}

      <LibModal
        open={!!del} onClose={() => setDel(null)} title="Usunąć materiał?"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setDel(null)}>ANULUJ</button>
            <button className="btn-blood" onClick={doDelete} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "USUŃ"}</button>
          </>
        }
      >
        <p className="text-sm text-foreground/70">
          Usunięcie „{item.title}" odbierze dostęp {del?.osoby ?? 0} {del?.osoby === 1 ? "osobie" : "osobom"}.
        </p>
        <p className="text-xs text-foreground/45">Materiał zniknie z bibliotek, ale historia zmian zostanie.</p>
      </LibModal>
    </div>
  );
}