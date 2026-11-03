import React, { useId } from "react";
import { Check } from "lucide-react";

// Wspólne pola formularza kwalifikacyjnego — styl spójny z resztą strony.

export function SectionHead({ children }) {
  return <p className="technical text-[11px] gold-text">{children}</p>;
}

export function Label({ children, required, htmlFor }) {
  return (
    <label htmlFor={htmlFor} className="technical text-[10px] text-foreground/55 block mb-3">
      {children}
      {required && <span className="gold-text"> *</span>}
    </label>
  );
}

export function Err({ msg, id }) {
  return msg ? <p id={id} role="alert" className="text-xs blood-text mt-2">{msg}</p> : null;
}

// Pola mają powiązaną etykietę (htmlFor/id) i przy błędzie aria-invalid + aria-describedby.
export function TextInput({ label, required, error, value, onChange, type = "text" }) {
  const id = useId();
  return (
    <div>
      <Label required={required} htmlFor={id}>{label}</Label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        aria-required={required ? "true" : undefined}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        className={`w-full bg-transparent border px-5 py-4 focus:outline-none transition-colors ${
          error ? "border-[#BC1E22]" : "hairline focus:border-[#C9A24A]"
        }`}
      />
      <Err msg={error} id={`${id}-err`} />
    </div>
  );
}

export function TextArea({ label, required, hint, error, value, onChange, rows = 4 }) {
  const id = useId();
  return (
    <div>
      <Label required={required} htmlFor={id}>{label}</Label>
      {hint && <p id={`${id}-hint`} className="text-xs text-foreground/55 mb-3">{hint}</p>}
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={onChange}
        aria-required={required ? "true" : undefined}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={[hint ? `${id}-hint` : "", error ? `${id}-err` : ""].filter(Boolean).join(" ") || undefined}
        className={`w-full bg-transparent border px-5 py-4 focus:outline-none transition-colors resize-y ${
          error ? "border-[#BC1E22]" : "hairline focus:border-[#C9A24A]"
        }`}
      />
      <Err msg={error} id={`${id}-err`} />
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

// Pole wyboru dostępne z klawiatury (ukryte wizualnie, nie „display: none”), z widocznym fokusem na kwadracie.
export function CheckRow({ checked, onChange, error, children }) {
  const id = useId();
  return (
    <div>
      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
        />
        <span
          aria-hidden="true"
          className={`mt-0.5 w-5 h-5 flex-shrink-0 border flex items-center justify-center transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#C9A24A] ${
            checked ? "border-[#C9A24A] bg-[#C9A24A]/10" : error ? "border-[#E24449]" : "hairline"
          }`}
        >
          {checked && <Check className="h-3.5 w-3.5 gold-text" />}
        </span>
        <span className="text-sm text-foreground/60 leading-relaxed">{children}</span>
      </label>
      <Err msg={error} id={`${id}-err`} />
    </div>
  );
}