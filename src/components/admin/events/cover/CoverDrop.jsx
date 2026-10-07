import React, { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";

// Duże pole „przeciągnij albo wybierz” (na telefonie: aparat lub galeria) z walidacją pliku.
export default function CoverDrop({ onFile, busy, progress }) {
  const ref = useRef(null);
  const [over, setOver] = useState(false);
  const [err, setErr] = useState("");

  const take = async (file) => {
    setErr("");
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setErr("Wybierz plik JPG, PNG albo WebP.");
    if (file.size > 10 * 1024 * 1024) return setErr("Plik jest większy niż 10 MB.");
    const url = URL.createObjectURL(file);
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; }).catch(() => null);
    if (!img) return setErr("Nie udało się odczytać obrazu.");
    if (img.width < 1920 || img.height < 1080) return setErr(`Obraz ma ${img.width}×${img.height} px — potrzeba co najmniej 1920×1080 px.`);
    onFile(file, img);
  };

  return (
    <div>
      <button type="button" disabled={busy} onClick={() => ref.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files[0]); }}
        className={`w-full min-h-[160px] border-2 border-dashed flex flex-col items-center justify-center gap-3 p-6 text-center focus-visible:ring-2 focus-visible:ring-[#C9A24A]/60 ${over ? "border-[#C9A24A] bg-[#C9A24A]/5" : "border-[#3D3D3F]"}`}>
        <ImagePlus className="h-8 w-8 text-[#C9A24A]" />
        <span className="text-base text-[#F5EFE1]">Przeciągnij zdjęcie albo wybierz z urządzenia</span>
        <span className="text-xs text-foreground/45">JPG, PNG, WebP · min. 1920×1080 px · maks. 10 MB</span>
      </button>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Wybierz okładkę" onChange={(e) => { take(e.target.files[0]); e.target.value = ""; }} />
      {busy && (
        <div className="mt-3" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Wgrywanie okładki">
          <div className="h-1.5 bg-[#1A1A1A]"><div className="h-full bg-[#C9A24A] transition-all" style={{ width: `${Math.max(4, progress * 100)}%` }} /></div>
          <p className="text-xs text-foreground/50 mt-1.5">Wgrywam i przygotowuję kadry… {Math.round(progress * 100)}%</p>
        </div>
      )}
      {err && <p role="alert" className="text-sm text-[#E5484D] mt-2">{err}</p>}
    </div>
  );
}