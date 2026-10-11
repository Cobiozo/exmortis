import React, { useEffect, useState } from "react";
import { Loader2, ChevronDown } from "lucide-react";
import { lib, inputCls } from "./libApi";
import LibModal from "./LibModal";
import ClientPicker from "./ClientPicker";
import AssignList from "./AssignList";

const EMPTY = {
  kind: "osoba", emails: [], group_id: "", group_mode: "OBECNI_I_PRZYSZLI",
  exceptions_add: [], exceptions_drop: [], note: "", visible_from: "", visible_to: "",
};

// Jedno okno przydziału — wołane z materiału, kolekcji, listy klientów i karty klienta.
export default function AssignDialog({ open, onClose, materialId, collectionId, label, presetEmails, onDone }) {
  const [groups, setGroups] = useState([]);
  const [t, setT] = useState(() => ({ ...EMPTY, emails: presetEmails || [] }));
  const [prev, setPrev] = useState(null);
  const [ver, setVer] = useState(0);
  const [openPrev, setOpenPrev] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { lib("groups_list").then((d) => setGroups(d.items)).catch(() => {}); }, []);

  const target = () => (t.kind === "osoba"
    ? { kind: "osoba", emails: t.emails }
    : { kind: "grupa", group_id: t.group_id, group_mode: t.group_mode, exceptions_add: t.exceptions_add, exceptions_drop: t.exceptions_drop });

  // Podsumowanie liczone tą samą regułą co wysyłka (mb_resolve_recipients).
  useEffect(() => {
    const ready = t.kind === "osoba" ? t.emails.length > 0 : !!t.group_id;
    if (!ready) { setPrev(null); return; }
    const timer = setTimeout(() => {
      lib("assignment_preview", { target: target() }).then(setPrev).catch(() => setPrev(null));
    }, 250);
    return () => clearTimeout(timer);
  }, [t, ver]);

  const set = (k, v) => setT((x) => ({ ...x, [k]: v }));

  const submit = async () => {
    setBusy(true); setErr("");
    try {
      await lib("assignment_save", {
        material_id: materialId, collection_id: collectionId, target: target(),
        note: t.note, visible_from: t.visible_from || null, visible_to: t.visible_to || null,
      });
      setT({ ...EMPTY, emails: presetEmails || [] });
      setVer((v) => v + 1);
      onDone?.();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <LibModal
      open={open} onClose={onClose} wide title="Przydziel dostęp"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>ZAMKNIJ</button>
          <button className="btn-relic" onClick={submit} disabled={busy || !prev}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "PRZYDZIEL"}
          </button>
        </>
      }
    >
      {label && <p className="text-sm text-foreground/60">{label}</p>}

      <div className="flex gap-2">
        {[["osoba", "Osoby"], ["grupa", "Grupy"]].map(([k, l]) => (
          <button key={k} onClick={() => set("kind", k)}
            className={`px-3 py-2 technical text-[10px] border hairline ${t.kind === k ? "bg-[#C9A24A] text-[#0A0A0B]" : "text-foreground/60 hover:gold-text"}`}>{l}</button>
        ))}
      </div>

      {t.kind === "osoba" ? (
        <ClientPicker value={t.emails} onChange={(v) => set("emails", v)} />
      ) : (
        <div className="space-y-3">
          <div>
            <label className="technical text-[10px] text-foreground/50 block mb-2">GRUPA</label>
            <select value={t.group_id} onChange={(e) => set("group_id", e.target.value)} className={inputCls}>
              <option value="">— wybierz —</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}{g.kind === "AUTOMATYCZNA" ? " (automatyczna)" : ""}</option>)}
            </select>
          </div>
          <div>
            <label className="technical text-[10px] text-foreground/50 block mb-2">KTO WCHODZI W GRĘ</label>
            <div className="flex flex-wrap gap-2">
              {[["OBECNI_I_PRZYSZLI", "Obecni i przyszli"], ["TYLKO_OBECNI", "Tylko obecni"]].map(([k, l]) => (
                <button key={k} onClick={() => set("group_mode", k)}
                  className={`px-3 py-2 technical text-[10px] border hairline ${t.group_mode === k ? "bg-[#C9A24A] text-[#0A0A0B]" : "text-foreground/60 hover:gold-text"}`}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="technical text-[10px] text-foreground/50 block mb-2">DODAJ SPOZA GRUPY</label>
            <ClientPicker value={t.exceptions_add} onChange={(v) => set("exceptions_add", v)} />
          </div>
          <div>
            <label className="technical text-[10px] text-foreground/50 block mb-2">WYKLUCZ Z GRUPY</label>
            <ClientPicker value={t.exceptions_drop} onChange={(v) => set("exceptions_drop", v)} />
          </div>
        </div>
      )}

      <div>
        <label className="technical text-[10px] text-foreground/50 block mb-2">NOTATKA DLA OSOBY</label>
        <textarea value={t.note} onChange={(e) => set("note", e.target.value)} rows={2} className={inputCls} />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="technical text-[10px] text-foreground/50 block mb-2">WIDOCZNE OD (CZASU PL)</label>
          <input type="datetime-local" value={t.visible_from} onChange={(e) => set("visible_from", e.target.value)} className={`${inputCls} dt-input`} />
        </div>
        <div>
          <label className="technical text-[10px] text-foreground/50 block mb-2">WIDOCZNE DO (CZASU PL)</label>
          <input type="datetime-local" value={t.visible_to} onChange={(e) => set("visible_to", e.target.value)} className={`${inputCls} dt-input`} />
        </div>
      </div>

      <div className="border hairline p-3">
        <button onClick={() => setOpenPrev((v) => !v)} className="w-full flex items-center justify-between gap-3 text-left">
          <span className="text-sm">Przydzielasz {prev ? prev.count : 0} {prev?.count === 1 ? "osobie" : "osobom"}</span>
          <ChevronDown className={`h-4 w-4 text-foreground/40 transition-transform ${openPrev ? "rotate-180" : ""}`} />
        </button>
        {openPrev && (
          <div className="mt-3 text-xs text-foreground/60 space-y-1 max-h-40 overflow-y-auto">
            {prev?.emails?.length
              ? prev.emails.map((e) => <p key={e}>{prev.names?.[e] ? `${prev.names[e]} · ${e}` : e}</p>)
              : <p className="text-foreground/40">Nikt nie pasuje do tej reguły.</p>}
          </div>
        )}
      </div>

      {err && <p className="text-sm blood-text">{err}</p>}

      <AssignList materialId={materialId} collectionId={collectionId} version={ver} onChange={() => onDone?.()} />
    </LibModal>
  );
}