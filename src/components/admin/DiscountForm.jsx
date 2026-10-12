import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

const inp = "w-full bg-[#0A0A0B] border hairline px-3 py-2 text-sm focus:border-[#C9A24A] focus:outline-none";
const EMPTY = { code: "", kind: "procent", value: "", valid_until: "", max_uses: "", product_ids: [], w_powiadomieniach: false, opis: "" };

export default function DiscountForm({ onDone }) {
  const [f, setF] = useState(EMPTY);
  const [products, setProducts] = useState([]);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    base44.functions.invoke("adminProducts", { action: "list" }).then((r) => setProducts(r.data.products));
  }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggleP = (id) => setF({ ...f, product_ids: f.product_ids.includes(id) ? f.product_ids.filter((x) => x !== id) : [...f.product_ids, id] });

  const submit = async (e) => {
    e.preventDefault();
    const code = f.code.trim().toUpperCase();
    if ((await base44.entities.DiscountCode.filter({ code })).length) return setMsg("Taki kod już istnieje.");
    const data = { code, kind: f.kind, value: Number(f.value), product_ids: f.product_ids, uses: 0, active: true };
    if (f.valid_until) data.valid_until = f.valid_until;
    if (f.max_uses) data.max_uses = Number(f.max_uses);
    if (f.w_powiadomieniach) { data.w_powiadomieniach = true; data.opis = f.opis.trim().slice(0, 120); }
    await base44.entities.DiscountCode.create(data);
    setF(EMPTY); setMsg("Kod dodany."); onDone();
  };

  return (
    <form onSubmit={submit} className="border hairline p-4 space-y-3 self-start">
      <p className="technical text-[10px] gold-text">NOWY KOD</p>
      <input required value={f.code} onChange={set("code")} placeholder="KOD (np. POWROT20)" className={inp} />
      <div className="flex gap-2">
        <select value={f.kind} onChange={set("kind")} className={inp}><option value="procent">%</option><option value="kwota">zł</option></select>
        <input required type="number" min="1" step="0.01" value={f.value} onChange={set("value")} placeholder="Wartość" className={inp} />
      </div>
      <label className="text-xs text-foreground/50 block">Ważny do (opcjonalnie)<input type="date" value={f.valid_until} onChange={set("valid_until")} className={inp + " mt-1"} /></label>
      <input type="number" min="1" value={f.max_uses} onChange={set("max_uses")} placeholder="Limit użyć (opcjonalnie)" className={inp} />
      <p className="text-xs text-foreground/50">Produkty (puste = wszystkie):</p>
      <div className="max-h-40 overflow-y-auto space-y-1">
        {products.map((p) => (
          <label key={p.id} className="flex gap-2 text-xs items-center"><input type="checkbox" checked={f.product_ids.includes(String(p.id))} onChange={() => toggleP(String(p.id))} />{p.name}</label>
        ))}
      </div>
      <label className="flex gap-2 text-xs items-start cursor-pointer"><input type="checkbox" checked={f.w_powiadomieniach} onChange={(e) => setF({ ...f, w_powiadomieniach: e.target.checked })} className="mt-0.5" />
        <span>Pokaż kod zalogowanym klientom w powiadomieniach (dzwoneczek). Bez zaznaczenia kod zna tylko ten, komu go dasz.</span></label>
      {f.w_powiadomieniach && <input value={f.opis} onChange={set("opis")} maxLength={120} placeholder="Krótki opis dla klienta (np. Na otwarcie Skarbca)" className={inp} />}
      <button className="btn-relic w-full !py-2.5">DODAJ KOD</button>
      {msg && <p className="text-xs gold-text">{msg}</p>}
    </form>
  );
}