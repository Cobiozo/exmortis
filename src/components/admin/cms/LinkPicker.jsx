import React, { useState } from "react";
import { ROUTES, linkError, cleanLink } from "@/components/cms/links";
import { inputCls } from "./ui";

// Wybór strony wewnętrznej z listy (z wyszukiwaniem) albo adres zewnętrzny https://.
export default function LinkPicker({ value, onChange, extra = [] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const all = [...ROUTES, ...extra];
  const list = all.filter(([p, l]) => (p + l).toLowerCase().includes(q.toLowerCase()));
  const current = all.find(([p]) => p === value);
  const err = value ? linkError(value, extra.map(([p]) => p)) : null;

  return (
    <div className="relative">
      <input className={inputCls} value={open ? q : current ? `${current[1]} (${current[0]})` : value || ""}
        placeholder="Wyszukaj stronę albo wpisz https://…"
        onFocus={() => { setOpen(true); setQ(current ? "" : value || ""); }}
        onBlur={() => setTimeout(() => { setOpen(false); if (q && !current) onChange(cleanLink(q)); }, 150)}
        onChange={(e) => setQ(e.target.value.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF\u00AD]/g, ""))} />
      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-[#0F0F10] border hairline">
          {/^(https:\/\/|#|\/)/.test(q) && (
            <button type="button" onMouseDown={() => { onChange(cleanLink(q)); setQ(""); }} className="block w-full text-left px-4 py-3 text-sm gold-text hover:bg-[#C9A24A]/10">
              Użyj adresu: {q}
            </button>
          )}
          {list.map(([p, l]) => (
            <button key={p} type="button" onMouseDown={() => { onChange(p); setQ(""); }} className="block w-full text-left px-4 py-3 text-sm hover:bg-[#C9A24A]/10">
              {l} <span className="text-foreground/40">{p}</span>
            </button>
          ))}
        </div>
      )}
      {err && <p className="text-xs blood-text mt-1">{err}</p>}
    </div>
  );
}