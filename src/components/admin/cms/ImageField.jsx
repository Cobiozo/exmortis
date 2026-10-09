import React, { useState } from "react";
import { Upload, Trash2, Loader2, FolderOpen } from "lucide-react";
import { uploadMedia } from "./media/uploadMedia";
import MediaPickerDialog from "./media/MediaPickerDialog";
import { inputCls, labelCls, smallBtn } from "./ui";
import CropPicker from "./media/CropPicker";

// Wgranie zdjęcia (przeciągnij/upuść, na telefonie aparat/galeria), punkt skupienia i opis alt.
export default function ImageField({ value, onChange, noAlt }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [pick, setPick] = useState(false);
  const v = value || {};
  const upload = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setErr("To nie jest obraz.");
    if (file.size > 10 * 1024 * 1024) return setErr("Maksymalnie 10 MB.");
    setErr(""); setBusy(true);
    const m = await uploadMedia(file);
    onChange({ ...v, url: m.url, fx: 50, fy: 50, kadr: v.kadr || null });
    setBusy(false);
  };
  const lib = (
    <>
      <button type="button" onClick={() => setPick(true)} className={smallBtn}><FolderOpen className="h-4 w-4" /> Z biblioteki</button>
      <MediaPickerDialog open={pick} onOpenChange={setPick} onPick={(m) => onChange({ ...v, url: m.url, alt: v.alt || m.alt || "", fx: 50, fy: 50 })} />
    </>
  );
  return (
    <div className="space-y-3">
      {v.url ? (
        <CropPicker v={v} onChange={onChange} noKadr={noAlt} />
      ) : (
        <label onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files[0]); }}
          className="flex flex-col items-center justify-center gap-2 min-h-[120px] border border-dashed hairline text-foreground/50 text-sm cursor-pointer hover:border-[#C9A24A]">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
          {busy ? "Wgrywanie…" : "Przeciągnij zdjęcie albo kliknij"}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files[0])} />
        </label>
      )}
      {!v.url && lib}
      {v.url && (
        <div className="flex flex-wrap gap-2">
          <label className={`${smallBtn} cursor-pointer`}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Podmień
            <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files[0])} /></label>
          {lib}
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