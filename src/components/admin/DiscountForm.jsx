import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

const inp = "w-full bg-[#0A0A0B] border hairline px-3 py-2 text-sm focus:border-[#C9A24A] focus:outline-none";
const EMPTY = {
  code: "", kind: "procent", value: "", od: "", valid_until: "", max_uses: "", product_ids: [], w_powiadomieniach: false, opis: "",
  bez_promocji: false, tylko_subskrybenci: false, tylko_konto: false,
};
const fromRecord = (c) => ({
  ...EMPTY, code: c.code || "", kind: c.kind || "procent", value: c.value ?? "", od: c.od || "", valid_until: c.valid_until || "",
  max_uses: c.max_uses ?? "", product_ids: (c.product_ids || []).map(String), w_powiadomieniach: c.w_powiadomieniach === true, opis: c.opis || "",
  bez_promocji: c.bez_promocji === true, tylko_subskrybenci: c.tylko_subskrybenci === true, tylko_konto: c.tylko_konto === true,
});

// Nowy kod albo edycja istniejącego (editing = rekord DiscountCode). Licznik użyć i sam kod przy edycji się nie zmieniają.
export default function DiscountForm({ onDone, editing = null, onCancel }) {
  const [f, setF] = useState(editing ? fromRecord(editing) : EMPTY);
  const [products, setProducts] = useState([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    base44.functions.invoke("adminProducts", { action: "list" }).then((r) => setProducts(r.data.products));
  }, []);
  useEffect(() => { setF(editing ? fromRecord(editing) : EMPTY); setMsg(""); }, [editing?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const flag = (k) => (e) => setF({ ...f, [k]: e.target.checked });
  const toggleP = (id) => setF({ ...f, product_ids: f.product_ids.includes(id) ? f.product_ids.filter((x) => x !== id) : [...f.product_ids, id] });

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    if (f.od && f.valid_until && f.valid_until < f.od) return setMsg("Data „ważny do” jest przed datą „ważny od”.");
    const code = f.code.trim().toUpperCase();
    const data = {
      kind: f.kind, value: Number(f.value), product_ids: f.product_ids,
      od: f.od || null, valid_until: f.valid_until || null, max_uses: f.max_uses ? Number(f.max_uses) : null,
      bez_promocji: f.bez_promocji, tylko_subskrybenci: f.tylko_subskrybenci, tylko_konto: f.tylko_konto,
      w_powiadomieniach: f.w_powiadomieniach, opis: f.w_powiadomieniach ? f.opis.trim().slice(0, 120) : (editing?.opis || ""),
    };
    setBusy(true);
    try {
      if (editing) {
        await base44.entities.DiscountCode.update(editing.id, data);
        setMsg("Zmiany zapisane.");
      } else {
        if ((await base44.entities.DiscountCode.filter({ code })).length) { setBusy(false); return setMsg("Taki kod już istnieje."); }
        await base44.entities.DiscountCode.create({ ...data, code, uses: 0, active: true });
        setF(EMPTY); setMsg("Kod dodany.");
      }
      onDone();
    } catch (err) {
      setMsg(err?.response?.data?.error || "Nie udało się zapisać kodu.");
    }
    setBusy(false);
  };

  const chk = "flex gap-2 text-xs items-start cursor-pointer";
  return (
    <form onSubmit={submit} className="border hairline p-4 space-y-3 self-start">
      <p className="technical text-[10px] gold-text">{editing ? `EDYCJA KODU ${editing.code}` : "NOWY KOD"}</p>
      {!editing && <input required value={f.code} onChange={set("code")} placeholder="KOD (np. POWROT20)" className={inp} />}
      <div className="flex gap-2">
        <select value={f.kind} onChange={set("kind")} className={inp} aria-label="Rodzaj rabatu"><option value="procent">%</option><option value="kwota">zł</option></select>
        <input required type="number" min="1" step="0.01" value={f.value} onChange={set("value")} placeholder="Wartość" className={inp} aria-label="Wartość rabatu" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-foreground/50 block">Ważny od (opcjonalnie)<input type="date" value={f.od} onChange={set("od")} className={inp + " mt-1"} /></label>
        <label className="text-xs text-foreground/50 block">Ważny do (opcjonalnie)<input type="date" value={f.valid_until} onChange={set("valid_until")} className={inp + " mt-1"} /></label>
      </div>
      <input type="number" min="1" value={f.max_uses} onChange={set("max_uses")} placeholder="Limit użyć (opcjonalnie)" className={inp} aria-label="Limit użyć" />
      <p className="text-xs text-foreground/50">Produkty (puste = wszystkie):</p>
      <div className="max-h-40 overflow-y-auto space-y-1">
        {products.map((p) => (
          <label key={p.id} className="flex gap-2 text-xs items-center"><input type="checkbox" checked={f.product_ids.includes(String(p.id))} onChange={() => toggleP(String(p.id))} />{p.name}</label>
        ))}
      </div>
      <fieldset className="space-y-2 border-t hairline pt-3">
        <legend className="sr-only">Kto i kiedy może użyć kodu</legend>
        <label className={chk}><input type="checkbox" checked={f.bez_promocji} onChange={flag("bez_promocji")} className="mt-0.5" />
          <span>Tylko cena regularna — kod nie działa, dopóki trwa promocja lub przedsprzedaż (cena niższa niż regularna).</span></label>
        <label className={chk}><input type="checkbox" checked={f.tylko_subskrybenci} onChange={flag("tylko_subskrybenci")} className="mt-0.5" />
          <span>Tylko dla subskrybentów Listów Powrotu — w kasie adres e-mail musi mieć potwierdzony zapis.</span></label>
        <label className={chk}><input type="checkbox" checked={f.tylko_konto} onChange={flag("tylko_konto")} className="mt-0.5" />
          <span>Tylko dla osób z kontem — trzeba być zalogowanym i kupować na adres tego konta.</span></label>
        <label className={chk}><input type="checkbox" checked={f.w_powiadomieniach} onChange={flag("w_powiadomieniach")} className="mt-0.5" />
          <span>Pokaż kod zalogowanym klientom w powiadomieniach (dzwoneczek). Bez zaznaczenia kod zna tylko ten, komu go dasz.</span></label>
      </fieldset>
      {f.w_powiadomieniach && <input value={f.opis} onChange={set("opis")} maxLength={120} placeholder="Krótki opis dla klienta (np. Na otwarcie Skarbca)" className={inp} />}
      <div className="flex gap-2">
        <button disabled={busy} className="btn-relic flex-1 !py-2.5">{editing ? "Zapisz zmiany" : "Dodaj kod"}</button>
        {editing && <button type="button" onClick={onCancel} className="btn-ghost !py-2.5">Anuluj</button>}
      </div>
      {msg && <p className="text-xs gold-text" role="status">{msg}</p>}
    </form>
  );
}
