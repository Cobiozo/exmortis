import React from "react";

// Pole formularza kasy: etykieta nad polem, znacznik „opcjonalnie”, podpowiedź albo błąd pod polem.
export const fieldCls =
  "w-full min-h-[48px] rounded-[var(--exm-r-field)] border border-exm-line bg-exm-surface px-4 py-3 text-[15px] text-exm-text placeholder:text-exm-muted transition-colors focus:border-exm-gold focus:outline-none";

export default function CheckoutField({ id, label, optional = false, hint, error, children }) {
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <label htmlFor={id} className="text-[13px] font-medium text-exm-text">{label}</label>
        {optional && <span className="text-[11px] text-exm-muted">opcjonalnie</span>}
      </div>
      {React.isValidElement(children)
        ? React.cloneElement(children, {
            "aria-describedby": describedBy,
            "aria-invalid": error ? true : undefined,
          })
        : children}
      {error ? (
        <p id={`${id}-err`} className="mt-2 text-[13px] text-[#E8C547]">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-2 text-[12px] leading-relaxed text-exm-muted">{hint}</p>
      ) : null}
    </div>
  );
}