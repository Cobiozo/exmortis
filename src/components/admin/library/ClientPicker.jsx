import React, { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { lib, inputCls } from "./libApi";

// Oznaczenia osoby w wyborze odbiorców (z serwera: zespół, konto testowe, kupujący).
export function Tags({ c }) {
  return (
    <span className="flex flex-wrap gap-1">
      {c.zespol && <span className="px-1.5 py-px text-[9px] technical border border-sky-400/40 text-sky-300">ZESPÓŁ</span>}
      {c.test && <span className="px-1.5 py-px text-[9px] technical border border-[#E8C547]/40 text-[#E8C547]">TEST</span>}
      {c.bez_konta && <span className="px-1.5 py-px text-[9px] technical border border-white/20 text-foreground/60">BEZ KONTA</span>}
      {c.kupujacy && <span className="px-1.5 py-px text-[9px] technical border border-emerald-400/40 text-emerald-300">KUPUJĄCY</span>}
    </span>
  );
}

// Wybór osób z listy klientów: szukanie, „Zaznacz wszystkich” (w obrębie wyszukania), „Tylko klienci”, „Odznacz”.
// `items` można podać z zewnątrz (bez ponownego pobierania listy).
export default function ClientPicker({ value = [], onChange, single, items: given }) {
  const [items, setItems] = useState(given || null);
  const [q, setQ] = useState("");
  useEffect(() => {
    if (given) { setItems(given); return; }
    lib("clients_list", {}).then((d) => setItems(d.items)).catch(() => setItems([]));
  }, [given]);

  const toggle = (email) => {
    if (single) { onChange(value[0] === email ? [] : [email]); return; }
    onChange(value.includes(email) ? value.filter((e) => e !== email) : [...value, email]);
  };

  if (!items) return <Loader2 className="h-4 w-4 animate-spin gold-text" aria-label="Wczytuję listę osób" />;
  const ql = q.trim().toLowerCase();
  const shown = items.filter((c) => !ql || c.email.includes(ql) || (c.name || "").toLowerCase().includes(ql));
  const addAll = (list) => onChange([...new Set([...value, ...list.map((c) => c.email)])]);
  const chip = "min-h-[34px] px-3 technical text-[10px] border hairline text-foreground/70 hover:gold-text";

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/35" aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj po imieniu lub e-mailu" aria-label="Szukaj osoby" className={`${inputCls} pl-9`} />
      </div>
      {!single && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={chip} onClick={() => addAll(shown)}>ZAZNACZ {ql ? "WYSZUKANE" : "WSZYSTKICH"} ({shown.length})</button>
          <button type="button" className={chip} onClick={() => onChange(shown.filter((c) => !c.test && !c.zespol).map((c) => c.email))}>TYLKO KLIENCI (BEZ TESTOWYCH I ZESPOŁU)</button>
          <button type="button" className={chip} onClick={() => addAll(shown.filter((c) => c.kupujacy))}>+ KUPUJĄCY</button>
          {value.length > 0 && <button type="button" className={chip} onClick={() => onChange([])}>ODZNACZ WSZYSTKO</button>}
        </div>
      )}
      <div className="border hairline max-h-60 overflow-y-auto divide-y divide-[#3D3D3F]/60">
        {shown.length === 0 ? (
          <p className="p-3 text-xs text-foreground/45">Brak osób dla tego szukania.</p>
        ) : shown.map((c) => (
          <label key={c.email} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[#0F0F10]">
            <input type={single ? "radio" : "checkbox"} checked={value.includes(c.email)} onChange={() => toggle(c.email)} className="accent-[#C9A24A] h-4 w-4" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm truncate">{c.name || c.email}</span>
              {c.name && <span className="block text-[11px] text-foreground/40 truncate">{c.email}</span>}
            </span>
            <Tags c={c} />
          </label>
        ))}
      </div>
      <p className="text-xs text-foreground/55">Zaznaczone: <strong className="text-foreground/80">{value.length}</strong>{items.length ? ` z ${items.length}` : ""}</p>
    </div>
  );
}
