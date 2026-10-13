import React from "react";

// Premiera o czasie: produkt „wkrótce” sam zmieni się na „dostępny” i powiadomi listę oczekujących.
export default function ReleaseFields({ form, set, labelCls, inputCls }) {
  return (
    <div className="sm:col-span-2 border hairline p-3 space-y-3">
      <div>
        <label className={labelCls}>PREMIERA O CZASIE (opcjonalnie)</label>
        <input type="datetime-local" value={form.release_at} onChange={(e) => set("release_at", e.target.value)} className={`${inputCls} dt-input`} />
        <p className="text-[11px] text-foreground/50 mt-1">
          O tej godzinie produkt zmieni się na „dostępny”, a lista oczekujących dostanie powiadomienie (sprawdzane co 5 minut, wymaga działającej wysyłki e-mail).
        </p>
      </div>
      {form.release_at && (
        <div>
          <label className={labelCls}>DOPISEK DO POWIADOMIENIA (np. kod dla listy)</label>
          <textarea rows={2} value={form.release_note} onChange={(e) => set("release_note", e.target.value)} className={inputCls} />
        </div>
      )}
    </div>
  );
}