import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import DiscountForm from "./DiscountForm";

const E = base44.entities.DiscountCode;

export default function DiscountsPanel() {
  const [codes, setCodes] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const load = () => E.list("-created_date", 200).then(setCodes);
  useEffect(() => { load(); }, []);

  const toggle = async (c) => { await E.update(c.id, { active: !c.active }); load(); };
  const remove = async (c) => { await E.delete(c.id); setConfirm(null); load(); };

  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-10">
      <DiscountForm onDone={load} />
      {!codes ? <Loader2 className="h-5 w-5 animate-spin gold-text" /> : codes.length === 0 ? (
        <p className="text-sm text-foreground/50">Brak kodów rabatowych.</p>
      ) : (
        <div className="border hairline divide-y divide-[#3D3D3F]/60">
          {codes.map((c) => (
            <div key={c.id} className={`p-4 flex flex-wrap items-center gap-4 ${c.active ? "" : "opacity-50"}`}>
              <div className="flex-1 min-w-[200px]">
                <p className="font-mono gold-text">{c.code}</p>
                <p className="text-xs text-foreground/50">
                  −{c.value}{c.kind === "procent" ? "%" : " zł"} · użyto {c.uses || 0}{c.max_uses ? `/${c.max_uses}` : ""}
                  {c.valid_until ? ` · do ${c.valid_until}` : ""} · {c.product_ids?.length ? `${c.product_ids.length} prod.` : "wszystkie produkty"}
                </p>
              </div>
              <button onClick={() => toggle(c)} className="btn-ghost !px-3 !py-1.5 text-[10px]">{c.active ? "WYŁĄCZ" : "WŁĄCZ"}</button>
              {confirm === c.id
                ? <button onClick={() => remove(c)} className="btn-blood !px-3 !py-1.5 text-[10px]">NA PEWNO USUŃ</button>
                : <button onClick={() => setConfirm(c.id)} className="btn-ghost !px-3 !py-1.5 text-[10px]">USUŃ</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}