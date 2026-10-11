import React, { useMemo, useState } from "react";
import { ArrowUp, ArrowDown, X, Plus } from "lucide-react";
import { inputCls, KIND_LABEL } from "./libApi";

export const MAX_ATTACHMENTS = 10;

// Wiele materiałów i kolekcji w jednej wiadomości: wyszukiwarka, kolejność strzałkami, usuwanie.
// value = [{ material_id } | { collection_id }]
export default function AttachmentPicker({ value, onChange, mats, cols }) {
  const [q, setQ] = useState("");
  const list = value || [];
  const key = (x) => (x.material_id ? `m:${x.material_id}` : `c:${x.collection_id}`);
  const chosen = useMemo(() => new Set(list.map(key)), [list]);

  const label = (x) => {
    if (x.material_id) {
      const m = mats.find((y) => y.id === x.material_id);
      return m ? `${KIND_LABEL[m.kind] || ""} · ${m.title}` : x.material_title || "Materiał";
    }
    const c = cols.find((y) => y.id === x.collection_id);
    return `Kolekcja · ${c ? c.title : x.collection_title || ""}`;
  };

  const options = useMemo(() => {
    const s = q.trim().toLowerCase();
    const all = [
      ...mats.map((m) => ({ k: `m:${m.id}`, v: { material_id: m.id }, t: `${KIND_LABEL[m.kind] || ""} · ${m.title}` })),
      ...cols.map((c) => ({ k: `c:${c.id}`, v: { collection_id: c.id }, t: `Kolekcja · ${c.title}` })),
    ].filter((o) => !chosen.has(o.k));
    return (s ? all.filter((o) => o.t.toLowerCase().includes(s)) : all).slice(0, 30);
  }, [q, mats, cols, chosen]);

  const full = list.length >= MAX_ATTACHMENTS;
  const add = (v) => { if (!full) onChange([...list, v]); };
  const remove = (i) => onChange(list.filter((_, j) => j !== i));
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <label className="technical text-[10px] text-foreground/50 block">DOŁĄCZ MATERIAŁY ({list.length}/{MAX_ATTACHMENTS})</label>

      {list.length > 0 && (
        <ol className="border hairline divide-y divide-white/5">
          {list.map((x, i) => (
            <li key={key(x)} className="flex items-center gap-2 px-3 py-2">
              <span className="text-xs text-foreground/40 w-5">{i + 1}.</span>
              <span className="text-sm flex-1 min-w-0 truncate">{label(x)}</span>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-1 text-foreground/50 hover:gold-text disabled:opacity-20" aria-label="W górę"><ArrowUp className="h-4 w-4" /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === list.length - 1} className="p-1 text-foreground/50 hover:gold-text disabled:opacity-20" aria-label="W dół"><ArrowDown className="h-4 w-4" /></button>
              <button type="button" onClick={() => remove(i)} className="p-1 text-foreground/50 hover:blood-text" aria-label="Usuń"><X className="h-4 w-4" /></button>
            </li>
          ))}
        </ol>
      )}

      {full ? (
        <p className="text-xs text-foreground/45">Osiągnięto limit {MAX_ATTACHMENTS} załączników.</p>
      ) : (
        <div className="border hairline p-3 space-y-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj materiału lub kolekcji…" className={inputCls} />
          <div className="max-h-48 overflow-y-auto divide-y divide-white/5">
            {options.length ? options.map((o) => (
              <button key={o.k} type="button" onClick={() => add(o.v)}
                className="w-full flex items-center gap-2 px-2 py-2 text-left text-sm hover:gold-text">
                <Plus className="h-4 w-4 shrink-0 text-foreground/40" />
                <span className="truncate">{o.t}</span>
              </button>
            )) : <p className="text-xs text-foreground/40 px-2 py-2">Brak pasujących pozycji.</p>}
          </div>
        </div>
      )}
      <p className="text-xs text-foreground/45">Każdy załącznik zostanie przydzielony tym samym odbiorcom w chwili wysłania.</p>
    </div>
  );
}
