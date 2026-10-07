import React, { useEffect, useState } from "react";
import { Wand2, Trash2, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import CoverDrop from "../cover/CoverDrop";
import FocusCrops from "../cover/FocusCrops";
import CoverTemplate from "../cover/CoverTemplate";
import { makeCrops, lumaOf, contrastFor, minDimFor, loadImg } from "../cover/coverKit";
import { Field, Group, inputCls } from "./ui";

// Krok 2: okładka — wgrywanie, punkt skupienia, kadry, przyciemnienie, opis, szablon.
export default function StepCover({ form: f, set, touch, errors, img, setImg }) {
  const c = f.cover;
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tpl, setTpl] = useState(false);
  const [err, setErr] = useState("");
  const setCover = (p) => set({ cover: { ...c, ...p } });

  // Istniejąca okładka: wczytaj obraz, by liczyć kontrast i móc przeliczyć kadry.
  useEffect(() => { if (c?.src && !img) loadImg(c.src).then(setImg).catch(() => {}); }, [c?.src]); // eslint-disable-line react-hooks/exhaustive-deps

  const upload = async (file, image, variant) => {
    setBusy(true); setProgress(0); setErr("");
    try {
      const src = (await base44.integrations.Core.UploadPublicFile({ file })).file_url;
      setProgress(1 / 6);
      const fx = 0.5, fy = 0.5;
      const crops = await makeCrops(image, fx, fy, (p) => setProgress(1 / 6 + (p * 5) / 6));
      setImg(image);
      const luma = lumaOf(image);
      set({ cover: { src, crops, fx, fy, alt: c?.alt || "", dim: Math.max(c?.dim ?? 45, minDimFor(luma)), source: variant === undefined ? "wgrana" : "szablon", variant: variant || 0, stale: false } });
      setTpl(false);
    } catch (e) { setErr(e.message || "Nie udało się wgrać okładki."); }
    setBusy(false);
  };
  const recrop = async () => {
    setBusy(true); setProgress(0);
    try { setCover({ crops: await makeCrops(img, c.fx, c.fy, setProgress), stale: false }); } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const luma = img ? lumaOf(img) : null;
  const ratio = luma === null ? null : contrastFor(luma, c?.dim ?? 45);
  const weak = ratio !== null && ratio < 4.5;

  return (
    <div className="space-y-8">
      <Group title="Okładka">
        {!c?.src || busy ? <CoverDrop onFile={(fl, im) => upload(fl, im)} busy={busy} progress={progress} /> : (
          <>
            <FocusCrops src={c.src} fx={c.fx ?? 0.5} fy={c.fy ?? 0.5} onFocus={(fx, fy) => setCover({ fx, fy, stale: true })} />
            {c.stale && (
              <div className="border border-[#E8C547]/50 p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <p className="text-sm text-[#E8C547] flex-1">Punkt skupienia się zmienił — kadry zostaną przeliczone przy zapisie.</p>
                {img && <button type="button" onClick={recrop} className="btn-ghost !px-4 !py-3"><RefreshCw className="h-4 w-4" /> PRZELICZ TERAZ</button>}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { set({ cover: { alt: c.alt, dim: c.dim } }); setImg(null); }} className="btn-ghost !px-4 !py-3">ZMIEŃ ZDJĘCIE</button>
              <button type="button" onClick={() => { set({ cover: null }); setImg(null); }} className="btn-ghost !px-4 !py-3 hover:!text-[#BC1E22]"><Trash2 className="h-4 w-4" /> USUŃ OKŁADKĘ</button>
            </div>
          </>
        )}
        {err && <p role="alert" className="text-sm text-[#E5484D]">{err}</p>}
        {!tpl && <button type="button" onClick={() => setTpl(true)} className="btn-ghost !px-4 !py-3 w-full sm:w-auto"><Wand2 className="h-4 w-4" /> GENERUJ Z SZABLONU</button>}
        {tpl && <CoverTemplate form={f} bgImg={c?.source === "wgrana" ? img : null} onUse={(fl, im, v) => upload(fl, im, v)} onClose={() => setTpl(false)} />}
      </Group>

      {c?.src && !busy && (
        <Group title="Tekst na okładce">
          <Field id="cover_dim" label={`Przyciemnienie · ${c.dim ?? 45}%`}>
            <input id="cover_dim" type="range" min="0" max="80" step="1" value={c.dim ?? 45} onChange={(e) => setCover({ dim: Number(e.target.value) })} className="w-full h-12 accent-[#C9A24A]" />
          </Field>
          {weak && (
            <p role="alert" className="text-sm text-[#E8C547] border border-[#E8C547]/50 p-3">
              Tekst może być nieczytelny (kontrast {ratio.toFixed(1)}:1, potrzeba 4,5:1). Zwiększ przyciemnienie do co najmniej {minDimFor(luma)}%.
            </p>
          )}
          <Field id="cover_alt" label="Opis obrazu (alt) *" error={errors.cover_alt} hint="Co widać na zdjęciu — czytają to czytniki ekranu.">
            <input id="cover_alt" value={c.alt || ""} onChange={(e) => setCover({ alt: e.target.value })} onBlur={() => touch("cover_alt")} className={inputCls} maxLength={300} />
          </Field>
        </Group>
      )}
    </div>
  );
}