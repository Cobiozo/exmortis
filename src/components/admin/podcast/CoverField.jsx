import React, { useRef, useState } from "react";
import { ImagePlus, Loader2, Music, Trash2, Youtube } from "lucide-react";
import { extractVideoId } from "@/components/exmortis/glos/youtube";
import { uploadImage } from "./podAdmin";

// Okładka utworu (27.11.2026): podgląd, wgranie z urządzenia, miniatura z YouTube i usunięcie.
// Kwadrat — tak okładka jest pokazywana na liście utworów i w odtwarzaczu na /glos.
export default function CoverField({ value, youtubeUrl, onChange, onError }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const ytId = extractVideoId(youtubeUrl || "");

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    onError?.("");
    try {
      onChange(await uploadImage(file));
    } catch (x) {
      onError?.(x?.message || "Nie udało się wgrać okładki.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <span className="block text-xs text-foreground/60">Okładka utworu</span>
      <div className="flex items-start gap-4">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded border hairline bg-[#161618]">
          {value ? (
            <img src={value} alt="Okładka utworu" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center"><Music className="h-6 w-6 gold-text" aria-hidden="true" /></span>
          )}
        </div>
        <div className="flex flex-col items-start gap-2">
          <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="btn-ghost !min-h-[36px] !px-3 text-[11px] disabled:opacity-40">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
            {value ? "Zmień okładkę" : "Wgraj okładkę"}
          </button>
          {ytId && (
            <button type="button" onClick={() => onChange(`https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`)} className="inline-flex items-center gap-1.5 text-[11px] text-foreground/60 hover:gold-text">
              <Youtube className="h-3.5 w-3.5" /> Użyj miniatury z YouTube
            </button>
          )}
          {value && (
            <button type="button" onClick={() => onChange("")} className="inline-flex items-center gap-1.5 text-[11px] text-foreground/50 hover:text-[#BC1E22]">
              <Trash2 className="h-3.5 w-3.5" /> Usuń okładkę
            </button>
          )}
          <span className="text-[11px] text-foreground/45">Najlepiej kwadrat, np. 1000 × 1000 px (JPG, PNG albo WEBP).</span>
        </div>
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={pick} />
    </div>
  );
}
