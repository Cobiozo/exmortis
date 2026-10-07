import React from "react";
import { Switch } from "@/components/ui/switch";

// Wspólne elementy formularza: pola ≥48 px, czcionka 16 px (iPhone nie przybliża), błędy pod polem.
export const inputCls = "w-full min-h-[48px] bg-transparent border hairline px-4 py-3 text-base text-foreground focus:border-[#C9A24A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A24A]/50 transition-colors";

export function Field({ id, label, error, hint, children }) {
  return (
    <div id={`f-${id}`} className="min-w-0">
      <label htmlFor={id} className="technical text-[10px] text-foreground/55 block mb-2">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-foreground/45 mt-1.5">{hint}</p>}
      {error && <p role="alert" className="text-sm text-[#E5484D] mt-1.5 w-full">{error}</p>}
    </div>
  );
}

export function Input({ id, form, set, touch, errors, label, hint, ...rest }) {
  return (
    <Field id={id} label={label} error={errors[id]} hint={hint}>
      <input id={id} value={form[id] ?? ""} onChange={(e) => set({ [id]: e.target.value })} onBlur={() => touch(id)}
        aria-invalid={!!errors[id]} className={inputCls} {...rest} />
    </Field>
  );
}

export function Toggle({ id, label, checked, onChange, hint }) {
  return (
    <div className="flex items-center justify-between gap-4 min-h-[48px] border hairline px-4 py-2">
      <label htmlFor={id} className="text-sm text-foreground/80">{label}{hint && <span className="block text-xs text-foreground/45">{hint}</span>}</label>
      <Switch id={id} checked={!!checked} onCheckedChange={onChange} />
    </div>
  );
}

export function Group({ title, children }) {
  return (
    <section role="group" aria-label={title} className="space-y-5 border-t hairline pt-6 first:border-t-0 first:pt-0">
      <h3 className="shop-heading text-xl text-[#F5EFE1] w-full">{title}</h3>
      {children}
    </section>
  );
}

export function Chips({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map(([v, l]) => (
        <button key={l} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className={`min-h-[44px] px-4 border text-sm focus-visible:ring-2 focus-visible:ring-[#C9A24A]/60 ${value === v ? "border-[#C9A24A] text-[#C9A24A]" : "hairline text-foreground/60"}`}>{l}</button>
      ))}
    </div>
  );
}