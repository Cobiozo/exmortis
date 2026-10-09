import React from "react";
import { INPUT, LABEL } from "./annForm";

const OPTS = [["wszyscy", "Wszystkie osoby z kontem"], ["produkt", "Osoby z dostępem do produktu lub kursu"], ["obok", "Uczestnicy Obok (seria)"], ["spotkanie", "Osoby zapisane na spotkanie"]];

// Wybór odbiorców ogłoszenia.
export default function AnnAudience({ f, set, options }) {
  const list = options?.[f.odbiorcy] || [];
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <label><span className={LABEL}>Odbiorcy</span>
        <select className={INPUT} value={f.odbiorcy} onChange={(e) => set({ odbiorcy: e.target.value, cel_id: "", cel_nazwa: "" })}>
          {OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      {f.odbiorcy !== "wszyscy" && (
        <label><span className={LABEL}>Wybierz</span>
          <select className={INPUT} value={f.cel_id} onChange={(e) => set({ cel_id: e.target.value, cel_nazwa: list.find((o) => o.id === e.target.value)?.nazwa || "" })}>
            <option value="">{options ? "— wybierz —" : "Wczytuję…"}</option>
            {list.map((o) => <option key={o.id} value={o.id}>{o.nazwa}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}