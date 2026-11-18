import React from "react";

// Pole formularza kontaktu (etap 8, 18.11.2026): etykieta nad polem powiązana z polem (htmlFor/id),
// pole min. 48 px, błąd pod polem połączony przez aria-describedby, opcjonalny licznik znaków.
const F = "w-full min-h-[48px] rounded-[var(--exm-r-field)] border bg-exm-bg px-4 py-3 text-[15px] text-exm-text placeholder:text-exm-muted transition-colors";

export default function ContactField({ id, label, textarea, error, licznik, ...props }) {
  const cls = `${F} ${error ? "border-[#E24449]" : "border-exm-line focus:border-exm-gold"}`;
  const opis = error ? `${id}-err` : licznik != null ? `${id}-licznik` : undefined;
  const aria = { id, "aria-invalid": !!error, "aria-describedby": opis };
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <label htmlFor={id} className="text-[13px] font-medium text-exm-text">{label}</label>
        {licznik != null && (
          <span id={`${id}-licznik`} className="text-[12px] tabular-nums text-exm-muted">Znaków: {licznik}</span>
        )}
      </div>
      {textarea
        ? <textarea rows={6} {...aria} {...props} className={`${cls} resize-y`} />
        : <input {...aria} {...props} className={cls} />}
      {error && <p id={`${id}-err`} role="alert" className="mt-2 text-[13px] text-[#E8C547]">{error}</p>}
    </div>
  );
}