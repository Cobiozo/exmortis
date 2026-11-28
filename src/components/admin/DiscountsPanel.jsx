import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import DiscountForm from "./DiscountForm";

const E = base44.entities.DiscountCode;

// Kody powitalne (20 zł od 49 zł, 7 dni od założenia konta) — tworzone automatycznie; tu tylko włącznik i podsumowanie.
function WelcomeBox({ codes }) {
  const [on, setOn] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { base44.functions.invoke("adminSettings", { action: "get_powitalny" }).then((r) => setOn(r.data.wlaczony)).catch(() => setOn(null)); }, []);
  const flip = async () => {
    setBusy(true);
    try { const r = await base44.functions.invoke("adminSettings", { action: "save", target: "powitalny", data: { wlaczony: !on } }); setOn(r.data.wlaczony); } catch { /* bez zmian */ }
    setBusy(false);
  };
  const used = codes.filter((c) => (c.uses || 0) > 0).length;
  return (
    <div className="border hairline p-4 space-y-2 lg:col-span-2">
      <div className="flex flex-wrap items-center gap-3">
        <p className="technical text-[10px] gold-text flex-1">KOD POWITALNY DLA NOWYCH KONT</p>
        {on !== null && (
          <button onClick={flip} disabled={busy} className="btn-ghost !px-3 !py-1.5 text-[10px]">{on ? "Wyłącz" : "Włącz"}</button>
        )}
      </div>
      <p className="text-xs text-foreground/55">
        {on === false ? "Wyłączony. " : "Włączony. "}Każde nowe, potwierdzone konto dostaje mailem jednorazowy kod 20 zł (zamówienie od 49 zł), ważny 7 dni od założenia konta,
        tylko dla adresu tego konta. Obejmuje e-booki, audio, wideo, kursy i pakiety (bez POWRÓT, usług, kart i biletów).
      </p>
      <p className="text-xs text-foreground/55">Wydane: {codes.length} · wykorzystane: {used}</p>
    </div>
  );
}

export default function DiscountsPanel() {
  const [codes, setCodes] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [editing, setEditing] = useState(null);
  const load = () => E.list("-created_date", 200).then(setCodes);
  useEffect(() => { load(); }, []);

  const toggle = async (c) => { await E.update(c.id, { active: !c.active }); load(); };
  const togglePublic = async (c) => { await E.update(c.id, { w_powiadomieniach: !c.w_powiadomieniach }); load(); };
  const remove = async (c) => { await E.delete(c.id); setConfirm(null); load(); };

  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-10">
      {codes && <WelcomeBox codes={codes.filter((c) => c.powitalny)} />}
      <DiscountForm onDone={load} editing={editing} onCancel={() => setEditing(null)} />
      {!codes ? <Loader2 className="h-5 w-5 animate-spin gold-text" /> : codes.filter((c) => !c.powitalny).length === 0 ? (
        <p className="text-sm text-foreground/50">Brak kodów rabatowych.</p>
      ) : (
        <div className="border hairline divide-y divide-[#3D3D3F]/60">
          {codes.filter((c) => !c.powitalny).map((c) => (
            <div key={c.id} className={`p-4 flex flex-wrap items-center gap-4 ${c.active ? "" : "opacity-50"}`}>
              <div className="flex-1 min-w-[200px]">
                <p className="font-mono gold-text">{c.code}</p>
                <p className="text-xs text-foreground/50">
                  −{c.value}{c.kind === "procent" ? "%" : " zł"} · użyto {c.uses || 0}{c.max_uses ? `/${c.max_uses}` : ""}
                  {c.od ? ` · od ${c.od}` : ""}{c.valid_until ? ` · do ${c.valid_until}` : ""} · {c.product_ids?.length ? `${c.product_ids.length} prod.` : "wszystkie produkty"}
                  {c.bez_promocji ? " · tylko cena regularna" : ""}{c.tylko_subskrybenci ? " · tylko subskrybenci Listów Powrotu" : ""}{c.tylko_konto ? " · tylko z kontem" : ""}
                  {(() => { const em = [...(c.emails || []), ...(c.email ? [c.email] : [])]; return em.length ? ` · tylko dla: ${em.length > 2 ? `${em.slice(0, 2).join(", ")} i ${em.length - 2} innych` : em.join(", ")}` : ""; })()}
                  {c.w_powiadomieniach ? " · widoczny w powiadomieniach klientów" : ""}
                </p>
              </div>
              <button onClick={() => { setEditing(c); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="btn-ghost !px-3 !py-1.5 text-[10px]">Edytuj</button>
              <button onClick={() => togglePublic(c)} className="btn-ghost !px-3 !py-1.5 text-[10px]" title="Pokaż / ukryj kod w powiadomieniach (dzwoneczek) zalogowanych klientów">
                {c.w_powiadomieniach ? "Ukryj z powiadomień" : "Pokaż w powiadomieniach"}
              </button>
              <button onClick={() => toggle(c)} className="btn-ghost !px-3 !py-1.5 text-[10px]">{c.active ? "Wyłącz" : "Włącz"}</button>
              {confirm === c.id
                ? <button onClick={() => remove(c)} className="btn-blood !px-3 !py-1.5 text-[10px]">Na pewno usuń</button>
                : <button onClick={() => setConfirm(c.id)} className="btn-ghost !px-3 !py-1.5 text-[10px]">Usuń</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}