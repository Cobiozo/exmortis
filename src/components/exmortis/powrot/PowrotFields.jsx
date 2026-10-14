import React from "react";
import { Check } from "lucide-react";

// Wspólne pola formularza kwalifikacyjnego — styl spójny z resztą strony.

export function SectionHead({ children }) {
  return <p className="technical text-[11px] gold-text">{children}</p>;
}

export function Label({ children, required }) {
  return (
    <label className="technical text-[10px] text-foreground/55 block mb-3">
      {children}
      {required && <span className="gold-text"> *</span>}
    </label>
  );
}

export function Err({ msg }) {
  return msg ? <p className="text-xs blood-text mt-2">{msg}</p> : null;
}

export function TextInput({ label, required, error, value, onChange, type = "text" }) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        className={`w-full bg-transparent border px-5 py-4 focus:outline-none transition-colors ${
          error ? "border-[#BC1E22]" : "hairline focus:border-[#C9A24A]"
        }`}
      />
      <Err msg={error} />
    </div>
  );
}

export function TextArea({ label, required, hint, error, value, onChange, rows = 4 }) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      {hint && <p className="text-xs text-foreground/55 mb-3">{hint}</p>}
      <textarea
        rows={rows}
        value={value}
        onChange={onChange}
        className={`w-full bg-transparent border px-5 py-4 focus:outline-none transition-colors resize-y ${
          error ? "border-[#BC1E22]" : "hairline focus:border-[#C9A24A]"
        }`}
      />
      <Err msg={error} />
    </div>
  );
}

const optBtn = (active) =>
  `text-left text-sm px-4 py-3 border transition-colors ${
    active
      ? "border-[#C9A24A] gold-text bg-[#C9A24A]/10"
      : "hairline text-foreground/60 hover:border-[#C9A24A]/60 hover:text-foreground"
  }`;

export function SingleChoice({ label, required, options, value, onSelect, error }) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o} type="button" onClick={() => onSelect(o)} className={optBtn(value === o)}>
            {o}
          </button>
        ))}
      </div>
      <Err msg={error} />
    </div>
  );
}

export function MultiChoice({ label, required, options, values, onToggle, error }) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            className={optBtn(values.includes(o))}
          >
            {values.includes(o) ? "✓ " : "+ "}
            {o}
          </button>
        ))}
      </div>
      <Err msg={error} />
    </div>
  );
}

export function CheckRow({ checked, onChange, error, children }) {
  return (
    <div>
      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          className="hidden"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span
          className={`mt-0.5 w-5 h-5 flex-shrink-0 border flex items-center justify-center transition-colors ${
            checked ? "border-[#C9A24A] bg-[#C9A24A]/10" : "hairline"
          }`}
        >
          {checked && <Check className="h-3.5 w-3.5 gold-text" />}
        </span>
        <span className="text-sm text-foreground/60 leading-relaxed">{children}</span>
      </label>
      <Err msg={error} />
    </div>
  );
}