import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { fieldCls } from "@/components/exmortis/shop/checkout/CheckoutField";

// Pole formularzy konta — ten sam wzorzec co w kasie: etykieta nad polem, min. 48 px,
// błąd pod polem powiązany przez aria-describedby. Hasło ma przycisk pokazania z etykietą dla czytników.
export default function AuthField({ id, label, aside, error, hint, type = "text", ...props }) {
  const [reveal, setReveal] = useState(false);
  const isPassword = type === "password";
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[13px] font-medium text-exm-text">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && reveal ? "text" : type}
          {...props}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={`${fieldCls} ${isPassword ? "pr-12" : ""}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            aria-label={reveal ? "Ukryj hasło" : "Pokaż hasło"}
            aria-pressed={reveal}
            className="absolute right-0 top-0 grid h-12 w-12 place-items-center rounded-[var(--exm-r-field)] text-exm-muted transition-colors hover:text-exm-ivory focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-exm-gold"
          >
            {reveal
              ? <EyeOff className="h-4 w-4" aria-hidden="true" />
              : <Eye className="h-4 w-4" aria-hidden="true" />}
          </button>
        )}
      </div>
      {error ? (
        <p id={`${id}-err`} className="mt-2 text-[13px] text-exm-error">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-2 text-[12px] leading-relaxed text-exm-muted">{hint}</p>
      ) : null}
      {aside && <div className="mt-1 flex">{aside}</div>}
    </div>
  );
}