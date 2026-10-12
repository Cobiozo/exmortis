import React from "react";
import { Plus, Trash2 } from "lucide-react";

// Drabinka cen przedsprzedaży: progi „do dnia → cena”. Po ostatnim progu obowiązuje cena regularna.
// Gdy drabinka jest ustawiona, zastępuje pola „Cena startowa” i „Promocja do”.
const fmt = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" }) : "…");

export default function PriceSteps({ value, onChange, regular, inputCls, labelCls }) {
  const steps = Array.isArray(value) ? value : [];
  const set = (i, k, v) => onChange(steps.map((s, j) => (j === i ? { ...s, [k]: v } : s)));
  const add = () => onChange([...steps, { do: "", cena: "" }].slice(0, 6));
  const del = (i) => onChange(steps.filter((_, j) => j !== i));
  const sorted = steps.filter((s) => s.do && s.cena !== "").slice().sort((a, b) => a.do.localeCompare(b.do));
  const warn = sorted.some((s) => regular !== "" && Number(s.cena) >= Number(regular));

  return (
    <div className="border hairline p-5 mb-10">
      <p className={labelCls}>DRABINKA CEN (PRZEDSPRZEDAŻ) — OPCJONALNIE</p>
      <p className="text-xs text-foreground/50 mb-4 max-w-2xl">
        Np. 47 zł do 22.11, 77 zł do 6.12, potem cena regularna. Cena zmienia się sama o północy (czas polski).
        Na stronie produktu klient widzi bieżącą cenę, datę jej końca, następną cenę i najniższą cenę z 30 dni (liczoną z historii cen).
        Gdy drabinka jest ustawiona, pola „Cena startowa” i „Promocja do” są pomijane.
      </p>
      {steps.map((s, i) => (
        <div key={i} className="flex flex-wrap items-end gap-3 mb-3">
          <div>
            <label className={labelCls}>CENA (ZŁ)</label>
            <input type="number" min="0" step="0.01" value={s.cena} onChange={(e) => set(i, "cena", e.target.value)} className={`${inputCls} font-mono w-32`} />
          </div>
          <div>
            <label className={labelCls}>OBOWIĄZUJE DO (WŁĄCZNIE)</label>
            <input type="date" value={s.do} onChange={(e) => set(i, "do", e.target.value)} className={`${inputCls} font-mono`} />
          </div>
          <button type="button" onClick={() => del(i)} className="text-foreground/40 hover:blood-text p-3" aria-label="Usuń próg"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      {steps.length < 6 && (
        <button type="button" onClick={add} className="technical text-[10px] gold-text inline-flex items-center gap-2 min-h-[40px]"><Plus className="h-4 w-4" /> DODAJ PRÓG</button>
      )}
      {sorted.length > 0 && (
        <p className="text-xs text-foreground/60 mt-4">
          {sorted.map((s, i) => `${s.cena} zł do ${fmt(s.do)}`).join(" → ")} → {regular !== "" ? `${regular} zł` : "cena regularna (uzupełnij)"}
        </p>
      )}
      {warn && <p className="text-xs text-[#E8C547] mt-2">Któryś próg jest równy albo wyższy od ceny regularnej — klient zobaczy przekreśloną cenę niższą od bieżącej.</p>}
    </div>
  );
}
