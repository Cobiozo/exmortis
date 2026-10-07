import React, { useState } from "react";
import { Upload, Trash2, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { inputCls, labelCls, smallBtn } from "./ui";

// Wgranie zdjęcia (przeciągnij/upuść, na telefonie aparat/galeria), punkt skupienia i opis alt.
export default function ImageField({ value, onChange, noAlt }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const v = value || {};
  const upload = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setErr("To nie jest obraz.");
    if (file.size > 10 * 1024 * 1024) return setErr("Maksymalnie 10 MB.");
    setErr(""); setBusy(true);
    const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
    onChange({ ...v, url: file_url, fx: 50, fy: 50 });
    setBusy(false);
  };
  const focus = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    onChange({ ...v, fx: Math.round(((e.clientX - r.left) / r.width) * 100), fy: Math.round(((e.clientY - r.top) / r.height) * 100) });
  };

  return (
    <div className="space-y-3">
      {v.url ? (
        <div className="relative cursor-crosshair" onClick={focus} title="Kliknij, aby ustawić punkt skupienia">
          <img src={v.url} alt="" className="w-full max-h-56 object-contain bg-black" />
          <span className="absolute h-5 w-5 -ml-2.5 -mt-2.5 rounded-full border-2 border-[#C9A24A] bg-[#C9A24A]/30 pointer-events-none" style={{ left: `${v.fx ?? 50}%`, top: `${v.fy ?? 50}%` }} />
        </div>
      ) : (
        <label onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files[0]); }}
          className="flex flex-col items-center justify-center gap-2 min-h-[120px] border border-dashed hairline text-foreground/50 text-sm cursor-pointer hover:border-[#C9A24A]">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
          {busy ? "Wgrywanie…" : "Przeciągnij zdjęcie albo kliknij"}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files[0])} />
        </label>
      )}
      {v.url && (
        <div className="flex flex-wrap gap-2">
          <label className={`${smallBtn} cursor-pointer`}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Podmień
            <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files[0])} /></label>
          <button type="button" onClick={() => onChange(null)} className={smallBtn}><Trash2 className="h-4 w-4" /> Usuń</button>
        </div>
      )}
      {v.url && !noAlt && (
        <div>
          <label className={labelCls}>OPIS ALT (WYMAGANY)</label>
          <input className={inputCls} value={v.alt || ""} onChange={(e) => onChange({ ...v, alt: e.target.value })} placeholder="Co przedstawia zdjęcie" />
        </div>
      )}
      {err && <p className="text-xs blood-text">{err}</p>}
    </div>
  );
}