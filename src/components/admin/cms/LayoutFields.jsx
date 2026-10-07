import React from "react";
import FieldInput from "./FieldInput";

const ALL = [
  { k: "szerokosc", label: "Szerokość", typ: "select", opcje: [["standard", "Standard"], ["waska", "Wąska (do czytania)"], ["pelna", "Pełna szerokość"]] },
  { k: "wyrownanie", label: "Wyrównanie tekstu", typ: "select", opcje: [["lewo", "Do lewej"], ["srodek", "Do środka"]] },
  { k: "tlo", label: "Tło sekcji", typ: "select", opcje: [["czern", "Czerń"], ["grafit", "Ciemny grafit"], ["bordo", "Bordo"], ["zdjecie", "Zdjęcie"]] },
  { k: "tlo_zdjecie", label: "Zdjęcie tła", typ: "image", noAlt: true, when: (u) => u.tlo === "zdjecie" },
  { k: "przyciemnienie", label: "Przyciemnienie (%)", typ: "number", min: 0, max: 95, when: (u) => u.tlo === "zdjecie" },
  { k: "odstep", label: "Odstęp nad i pod", typ: "select", opcje: [["maly", "Mały"], ["sredni", "Średni"], ["duzy", "Duży"], ["xl", "Bardzo duży"]] },
  { k: "numer", label: "Numer sekcji", typ: "select", opcje: [["auto", "Automatyczny"], ["wlasny", "Własny"], ["brak", "Brak"]] },
  { k: "numer_wlasny", label: "Własny numer (np. 08)", typ: "text", when: (u) => u.numer === "wlasny" },
];
const COMMON = [
  { k: "urzadzenia", label: "Widoczny na", typ: "select", opcje: [["wszedzie", "Wszędzie"], ["telefon", "Tylko telefon"], ["komputer", "Tylko komputer"]] },
  { k: "kotwica", label: "Kotwica (adres #…, opcjonalnie)", typ: "text" },
];

// Ustawienia układu bloku. Bloki „bare” (nagłówek, moduł) mają tylko widoczność, numer i kotwicę.
export default function LayoutFields({ u, bare, onChange }) {
  const fields = bare ? [ALL[6], ALL[7], ...COMMON] : [...ALL, ...COMMON];
  return (
    <div className="grid sm:grid-cols-2 gap-5">
      {fields.filter((f) => !f.when || f.when(u)).map((f) => (
        <div key={f.k} className={f.typ === "image" ? "sm:col-span-2" : ""}>
          <FieldInput f={f} value={u[f.k]} onChange={(v) => onChange({ ...u, [f.k]: f.k === "kotwica" ? String(v).replace(/[^a-z0-9-]/gi, "").toLowerCase() : v })} />
        </div>
      ))}
    </div>
  );
}