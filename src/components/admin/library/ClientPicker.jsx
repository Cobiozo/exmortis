import React, { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { lib, inputCls } from "./libApi";

// Wybór osób z listy klientów. Pobiera listę raz i filtruje lokalnie w obrębie wyniku serwera.
export default function ClientPicker({ value = [], onChange, single }) {
  const [items, setItems] = useState(null);
  const [q, setQ] = useState("");
  useEffect(() => { lib("clients_list", {}).then((d) => setItems(d.items)).catch(() => setItems([])); }, []);

  const toggle = (email) => {
    if (single) { onChange(value[0] === email ? [] : [email]); return; }
    onChange(value.includes(email) ? value.filter((e) => e !== email) : [...value, email]);
  };

  if (!items) return <Loader2 className="h-4 w-4 animate-spin gold-text" />;
  const shown = items.filter((c) => !q || c.email.includes(q.toLowerCase()) || (c.name || "").toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/35" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj osoby" className={`${inputCls} pl-9`} />
      </div>
      <div className="border hairline max-h-52 overflow-y-auto divide-y divide-[#3D3D3F]/60">
        {shown.length === 0 ? (
          <p className="p-3 text-xs text-foreground/45">Brak osób dla tego szukania.</p>
        ) : shown.map((c) => (
          <label key={c.email} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-[#0F0F10]">
            <input type={single ? "radio" : "checkbox"} checked={value.includes(c.email)} onChange={() => toggle(c.email)} className="accent-[#C9A24A]" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm truncate">{c.name || c.email}</span>
              {c.name && <span className="block text-[11px] text-foreground/40 truncate">{c.email}</span>}
            </span>
          </label>
        ))}
      </div>
      <p className="text-xs text-foreground/45">Wybrane: {value.length}</p>
    </div>
  );
}