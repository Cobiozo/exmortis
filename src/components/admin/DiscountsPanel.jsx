import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import DiscountForm from "./DiscountForm";

const E = base44.entities.DiscountCode;

// Kody powitalne (−20%, 7 dni od założenia konta) — tworzone automatycznie; tu tylko włącznik i podsumowanie.
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
          <button onClick={flip} disabled={busy} className="btn-ghost !px-3 !py-1.5 text-[10px]">{on ? "WYŁĄCZ" : "WŁĄCZ"}</button>
        )}
      </div>
      <p className="text-xs text-foreground/55">
        {on === false ? "Wyłączony. " : "Włączony. "}Każde nowe, potwierdzone konto dostaje mailem jednorazowy kod −20%, ważny 7 dni od założenia konta,
        tylko dla adresu tego konta. Obejmuje ebooki, audio, wideo i kursy w cenie regularnej (bez POWRÓT, kart, biletów i przedsprzedaży).
      </p>
      <p className="text-xs text-foreground/55">Wydane: {codes.length} · wykorzystane: {used}</p>
    </div>
  );
}

export default function DiscountsPanel() {
  const [codes, setCodes] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const load = () => E.list("-created_date", 200).then(setCodes);
  useEffect(() => { load(); }, []);

  const toggle = async (c) => { await E.update(c.id, { active: !c.active }); load(); };
  const togglePublic = async (c) => { await E.update(c.id, { w_powiadomieniach: !c.w_powiadomieniach }); load(); };
  const remove = async (c) => { await E.delete(c.id); setConfirm(null); load(); };

  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-10">
      {codes && <WelcomeBox codes={codes.filter((c) => c.powitalny)} />}
      <DiscountForm onDone={load} />
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
                  {c.valid_until ? ` · do ${c.valid_until}` : ""} · {c.product_ids?.length ? `${c.product_ids.length} prod.` : "wszystkie produkty"}
                  {c.w_powiadomieniach ? " · widoczny w powiadomieniach klientów" : ""}
                </p>
              </div>
              <button onClick={() => togglePublic(c)} className="btn-ghost !px-3 !py-1.5 text-[10px]" title="Pokaż / ukryj kod w powiadomieniach (dzwoneczek) zalogowanych klientów">
                {c.w_powiadomieniach ? "UKRYJ Z POWIADOMIEŃ" : "POKAŻ W POWIADOMIENIACH"}
              </button>
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