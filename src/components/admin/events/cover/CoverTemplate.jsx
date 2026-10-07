import React, { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { VARIANTS, renderTemplate, downloadCanvas, canvasBlob } from "./template";
import { SOCIAL } from "./coverKit";
import { startIso } from "../form/eventForm";

// „Generuj okładkę z szablonu”: 3 warianty z podglądem na żywo, zapis jako okładka, grafiki social media.
export default function CoverTemplate({ form, bgImg, onUse, onClose }) {
  const [variant, setVariant] = useState(form.cover?.variant || 0);
  const [thumbs, setThumbs] = useState([]);
  const [busy, setBusy] = useState("");
  const ev = { ...form, start_datetime: startIso(form) };

  useEffect(() => {
    let on = true;
    Promise.all(VARIANTS.map((_, i) => renderTemplate(ev, 640, 360, i, bgImg).then((c) => c.toDataURL("image/jpeg", 0.8))))
      .then((t) => on && setThumbs(t));
    return () => { on = false; };
  }, [form.title, form.event_type, form.date, form.time, form.format, form.price, bgImg]); // eslint-disable-line react-hooks/exhaustive-deps

  const use = async () => {
    setBusy("use");
    const cv = await renderTemplate(ev, 1920, 1080, variant, bgImg);
    const file = new File([await canvasBlob(cv, "image/png")], "okladka-szablon.png", { type: "image/png" });
    const img = new Image(); img.src = cv.toDataURL("image/png"); await img.decode();
    await onUse(file, img, variant);
    setBusy("");
  };
  const social = async (s) => {
    setBusy(s.key);
    await downloadCanvas(await renderTemplate(ev, s.w, s.h, variant, bgImg, s.key === "story"), `exmortis-${s.key}-${s.w}x${s.h}.png`);
    setBusy("");
  };

  return (
    <div className="border border-[#C9A24A]/40 p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="shop-heading text-lg text-[#F5EFE1]">Okładka z szablonu</p>
        <button type="button" onClick={onClose} className="text-sm text-foreground/50 underline min-h-[44px]">Zamknij</button>
      </div>
      <div role="radiogroup" aria-label="Wariant kompozycji" className="grid sm:grid-cols-3 gap-3">
        {VARIANTS.map((v, i) => (
          <button type="button" key={v} role="radio" aria-checked={variant === i} onClick={() => setVariant(i)}
            className={`text-left border p-1.5 focus-visible:ring-2 focus-visible:ring-[#C9A24A] ${variant === i ? "border-[#C9A24A]" : "hairline"}`}>
            {thumbs[i] ? <img src={thumbs[i]} alt={`Wariant ${v}`} className="w-full aspect-video object-cover" /> : <div className="w-full aspect-video bg-[#121212] animate-pulse" />}
            <span className="block text-xs mt-1.5 text-foreground/70">{v}</span>
          </button>
        ))}
      </div>
      <button type="button" disabled={!!busy} onClick={use} className="btn-relic w-full sm:w-auto disabled:opacity-60">
        {busy === "use" && <Loader2 className="h-4 w-4 animate-spin" />} UŻYJ JAKO OKŁADKI
      </button>
      <div>
        <p className="technical text-[10px] text-foreground/50 mb-2">POBIERZ GRAFIKI DO SOCIAL MEDIA</p>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
          {SOCIAL.map((s) => (
            <button type="button" key={s.key} disabled={!!busy} onClick={() => social(s)} className="btn-ghost !px-4 !py-3 disabled:opacity-60">
              {busy === s.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {s.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-foreground/40 mt-2">Relacja zostawia wolną dolną trzecią część na naklejkę z linkiem.</p>
      </div>
    </div>
  );
}