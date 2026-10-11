import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { lib, inputCls, GROUP_COLORS } from "./libApi";
import LibModal from "./LibModal";

// Grupa: ręczna (nazwa, kolor, opis) albo automatyczna (reguła zakupowa / pakietowa).
export default function GroupForm({ open, onClose, item, onDone }) {
  const [f, setF] = useState(() => ({
    id: item?.id || null,
    name: item?.name || "",
    color: item?.color || GROUP_COLORS[0],
    description: item?.description || "",
    kind: item?.kind || "RECZNA",
    typ: item?.rule?.typ || "produkt",
    product_id: item?.rule?.id || "",
    type_id: item?.rule?.type_id || "",
  }));
  const [opts, setOpts] = useState({ produkty: [], typy: [] });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => { lib("rule_options").then(setOpts).catch(() => {}); }, []);

  const save = async () => {
    setErr(""); setBusy(true);
    try {
      const rule = f.kind === "AUTOMATYCZNA"
        ? (f.typ === "produkt" ? { typ: "produkt", id: f.product_id } : { typ: "aktywny_pakiet", type_id: f.type_id || null })
        : null;
      await lib("group_save", { id: f.id, name: f.name, color: f.color, description: f.description, kind: f.kind, rule });
      onDone();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <LibModal
      open={open} onClose={onClose} wide title={item ? "Edytuj grupę" : "Nowa grupa"}
      footer={<>
        <button className="btn-ghost" onClick={onClose}>ANULUJ</button>
        <button className="btn-relic" onClick={save} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "ZAPISZ"}</button>
      </>}
    >
      <div>
        <label className="technical text-[10px] text-foreground/50 block mb-2">NAZWA</label>
        <input value={f.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
      </div>

      <div>
        <label className="technical text-[10px] text-foreground/50 block mb-2">KOLOR</label>
        <div className="flex flex-wrap gap-2">
          {GROUP_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => set("color", c)} aria-label={`Kolor ${c}`}
              style={{ background: c }}
              className={`h-8 w-8 border ${f.color === c ? "border-[#C9A24A]" : "border-[#3D3D3F]"}`} />
          ))}
        </div>
      </div>

      <div>
        <label className="technical text-[10px] text-foreground/50 block mb-2">OPIS</label>
        <input value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Widoczny tylko dla Ciebie" className={inputCls} />
      </div>

      {!item && (
        <>
          <div>
            <label className="technical text-[10px] text-foreground/50 block mb-2">RODZAJ</label>
            <div className="flex gap-2">
              {[["RECZNA", "Ręczna"], ["AUTOMATYCZNA", "Automatyczna"]].map(([k, l]) => (
                <button key={k} onClick={() => set("kind", k)}
                  className={`px-3 py-2 technical text-[10px] border hairline ${f.kind === k ? "bg-[#C9A24A] text-[#0A0A0B]" : "text-foreground/60 hover:gold-text"}`}>{l}</button>
              ))}
            </div>
          </div>

          {f.kind === "AUTOMATYCZNA" && (
            <div className="space-y-3 border hairline p-3">
              <div className="flex gap-2">
                {[["produkt", "Kupił produkt"], ["aktywny_pakiet", "Aktywny pakiet"]].map(([k, l]) => (
                  <button key={k} onClick={() => set("typ", k)}
                    className={`px-3 py-2 technical text-[10px] border hairline ${f.typ === k ? "bg-[#C9A24A] text-[#0A0A0B]" : "text-foreground/60 hover:gold-text"}`}>{l}</button>
                ))}
              </div>
              {f.typ === "produkt" ? (
                <select value={f.product_id} onChange={(e) => set("product_id", e.target.value)} className={inputCls}>
                  <option value="">— produkt ze Skarbca —</option>
                  {opts.produkty.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              ) : (
                <>
                  <select value={f.type_id} onChange={(e) => set("type_id", e.target.value)} className={inputCls}>
                    <option value="">— każdy aktywny pakiet —</option>
                    {opts.typy.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <p className="text-xs text-foreground/45">Bez wyboru reguła obejmuje każdy aktywny pakiet.</p>
                </>
              )}
              <p className="text-xs text-foreground/45">Członkostwo liczy baza przy każdym otwarciu — nic nie jest kopiowane na osoby.</p>
            </div>
          )}
        </>
      )}

      {err && <p className="text-sm blood-text">{err}</p>}
    </LibModal>
  );
}