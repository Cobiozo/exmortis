import React, { useEffect, useState } from "react";
import { Loader2, ChevronDown } from "lucide-react";
import { lib, inputCls } from "./libApi";
import LibModal from "./LibModal";
import TargetPicker, { EMPTY_TARGET } from "./TargetPicker";
import AssignList from "./AssignList";

// Jedno okno przydziału — wołane z materiału, kolekcji, listy klientów, karty klienta i karty grupy.
// Odbiorców wybiera się tym samym komponentem co przy wiadomości (TargetPicker).
export default function AssignDialog({ open, onClose, materialId, collectionId, label, presetEmails, presetGroupId, onDone }) {
  const [t, setT] = useState(() => ({ ...EMPTY_TARGET, emails: presetEmails || [], group_id: presetGroupId || "" }));
  const [prev, setPrev] = useState(null);
  const [ver, setVer] = useState(0);
  const [openPrev, setOpenPrev] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

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

  const submit = async () => {
    setBusy(true); setErr("");
    try {
      await lib("assignment_save", {
        material_id: materialId, collection_id: collectionId, target: target(),
        note: t.note, visible_from: t.visible_from || null, visible_to: t.visible_to || null,
      });
      setT({ ...EMPTY_TARGET, emails: presetEmails || [] });
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

      <TargetPicker value={t} onChange={(v) => setT({ ...v, note: t.note, visible_from: t.visible_from, visible_to: t.visible_to })} />

      <div>
        <label className="technical text-[10px] text-foreground/50 block mb-2">NOTATKA DLA OSOBY</label>
        <textarea value={t.note} onChange={(e) => setT({ ...t, note: e.target.value })} rows={2} className={inputCls} />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="technical text-[10px] text-foreground/50 block mb-2">WIDOCZNE OD (CZASU PL)</label>
          <input type="datetime-local" value={t.visible_from} onChange={(e) => setT({ ...t, visible_from: e.target.value })} className={`${inputCls} dt-input`} />
        </div>
        <div>
          <label className="technical text-[10px] text-foreground/50 block mb-2">WIDOCZNE DO (CZASU PL)</label>
          <input type="datetime-local" value={t.visible_to} onChange={(e) => setT({ ...t, visible_to: e.target.value })} className={`${inputCls} dt-input`} />
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