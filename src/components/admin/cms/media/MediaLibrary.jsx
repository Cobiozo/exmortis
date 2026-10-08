import React, { useEffect, useState } from "react";
import { Upload, Trash2, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";
import { inputCls, smallBtn } from "../ui";
import { uploadMedia } from "./uploadMedia";

// Biblioteka mediów: wyszukiwanie, wgrywanie (WebP), usuwanie. onPick — tryb wyboru.
export default function MediaLibrary({ onPick }) {
  const [items, setItems] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const query = q.trim() ? { nazwa: { $regex: q.trim().replace(/[.*+?^${}()|[\]\\]/g, ""), $options: "i" } } : {};
  const load = (more) => base44.entities.MediaAsset.filter(query, { sort: "-created_date", limit: 40, cursor: more ? cursor : undefined })
    .then((p) => { setItems((x) => (more ? [...x, ...p.items] : p.items)); setCursor(p.has_more ? p.next_cursor : null); });
  useEffect(() => { const t = setTimeout(() => load(false), 300); return () => clearTimeout(t); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = async (files) => {
    setBusy(true);
    for (const f of [...files].filter((f) => f.type.startsWith("image/") && f.size <= 15 * 1024 * 1024)) await uploadMedia(f);
    setBusy(false);
    load(false);
  };
  const remove = async (m) => {
    if (!window.confirm(`Usunąć „${m.nazwa}” z biblioteki? Strony, które go używają, zachowają obraz.`)) return;
    await base44.entities.MediaAsset.delete(m.id);
    setItems((x) => x.filter((i) => i.id !== m.id));
  };

  return (
    <div className="space-y-4" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); add(e.dataTransfer.files); }}>
      <div className="flex flex-col sm:flex-row gap-3">
        <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj po nazwie" />
        <label className={`${smallBtn} cursor-pointer shrink-0`}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {busy ? "Wgrywanie…" : "Wgraj"}
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => add(e.target.files)} /></label>
      </div>
      {!items ? <div className="h-40 animate-pulse bg-[#0F0F10]" /> : !items.length ? <p className="text-sm text-foreground/50 py-8 text-center">Brak plików. Przeciągnij zdjęcia tutaj.</p> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {items.map((m) => (
            <div key={m.id} className="group border hairline">
              <button type="button" onClick={() => onPick?.(m)} className={`block w-full aspect-square ${onPick ? "hover:opacity-80" : "cursor-default"}`}>
                <Image src={m.url} alt={m.alt || ""} className="w-full h-full" />
              </button>
              <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                <span className="text-[11px] text-foreground/60 truncate">{m.nazwa}{m.rozmiar_kb ? ` · ${m.rozmiar_kb} KB` : ""}</span>
                {!onPick && <button onClick={() => remove(m)} aria-label="Usuń" className="text-foreground/40 hover:text-[#BC1E22]"><Trash2 className="h-3.5 w-3.5" /></button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {cursor && <button onClick={() => load(true)} className={smallBtn}>Pokaż więcej</button>}
    </div>
  );
}