import React, { useState } from "react";
import AnnAudience from "./AnnAudience";
import AnnPreview from "./AnnPreview";
import { INPUT, LABEL, toLocal, fromLocal } from "./annForm";

const KINDS = [["ogloszenie", "Ogłoszenie"], ["zaproszenie", "Zaproszenie"], ["przypomnienie", "Przypomnienie"]];

// Formularz ogłoszenia: treść, przycisk, odbiorcy, termin, zamykanie, ważność + podgląd.
export default function AnnForm({ initial, options, busy, onSave, onCancel }) {
  const [f, setF] = useState(initial);
  const [preview, setPreview] = useState(false);
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const radio = (k, v, l) => (
    <label className="inline-flex items-center gap-2 mr-5 min-h-[44px] cursor-pointer">
      <input type="radio" checked={f[k] === v} onChange={() => set({ [k]: v })} className="accent-[#C9A24A]" />{l}
    </label>
  );
  return (
    <div className="space-y-6 border border-[#3D3D3F] p-5 md:p-6">
      <div><span className={LABEL}>Rodzaj</span>{KINDS.map(([v, l]) => radio("rodzaj", v, l))}</div>
      <label className="block"><span className={LABEL}>Tytuł ({f.tytul.length}/60)</span>
        <input className={INPUT} maxLength={60} value={f.tytul} onChange={(e) => set({ tytul: e.target.value })} /></label>
      <label className="block"><span className={LABEL}>Treść ({f.tresc.length}/200) · **pogrubienie**, [tekst](adres)</span>
        <textarea className={INPUT} rows={3} maxLength={200} value={f.tresc} onChange={(e) => set({ tresc: e.target.value })} /></label>
      <div className="grid sm:grid-cols-2 gap-4">
        <label><span className={LABEL}>Przycisk — napis (opcjonalnie, {f.przycisk_napis.length}/30)</span>
          <input className={INPUT} maxLength={30} value={f.przycisk_napis} onChange={(e) => set({ przycisk_napis: e.target.value })} /></label>
        <label><span className={LABEL}>Przycisk — link (/strona albo https://…)</span>
          <input className={INPUT} value={f.przycisk_link} onChange={(e) => set({ przycisk_link: e.target.value })} placeholder="/spotkania" /></label>
      </div>
      <AnnAudience f={f} set={set} options={options} />
      <div className="grid sm:grid-cols-2 gap-4">
        <label><span className={LABEL}>Od (puste = od razu)</span>
          <input type="datetime-local" className={`${INPUT} dt-input`} value={toLocal(f.od)} onChange={(e) => set({ od: fromLocal(e.target.value) })} /></label>
        <label><span className={LABEL}>Do (puste = bez końca)</span>
          <input type="datetime-local" className={`${INPUT} dt-input`} value={toLocal(f.do)} onChange={(e) => set({ do: fromLocal(e.target.value) })} /></label>
      </div>
      <div><span className={LABEL}>Czy można zamknąć</span>{radio("zamykalne", true, "Tak")}{radio("zamykalne", false, "Nie")}</div>
      <div><span className={LABEL}>Ważność</span>{radio("wazne", false, "Zwykła")}{radio("wazne", true, "Ważna")}</div>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn-ghost" onClick={() => setPreview((p) => !p)}>{preview ? "Ukryj podgląd" : "Podgląd"}</button>
        <button type="button" className="btn-ghost" disabled={busy} onClick={() => onSave(f, "save")}>Zapisz szkic</button>
        <button type="button" className="btn-relic" disabled={busy} onClick={() => onSave(f, "publish")}>{f.od && new Date(f.od) > new Date() ? "Zaplanuj" : "Opublikuj"}</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Anuluj</button>
      </div>
      {preview && <AnnPreview f={f} />}
    </div>
  );
}