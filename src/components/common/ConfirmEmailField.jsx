import React from "react";

// Drugie pole „Powtórz adres e-mail” (25.11.2026, decyzja właściciela): adres trzeba wpisać ręcznie drugi raz —
// wklejanie, przeciąganie i autouzupełnianie są wyłączone. Wiele zamówień przepadało przez literówkę w adresie.
// Użycie: <ConfirmEmailField id="co-email2" email={form.email} value={email2} onChange={setEmail2} className={fieldCls} />
// sameEmail(email, value) — czy adresy są zgodne (bez wielkości liter i spacji na końcach).
export const sameEmail = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

export default function ConfirmEmailField({ id, email, value, onChange, className = "", labelClassName, label = "Powtórz adres e-mail" }) {
  const block = (e) => e.preventDefault();
  const typed = String(value || "").trim().length > 0;
  const mismatch = typed && String(email || "").trim() && !sameEmail(email, value);
  // Komunikat dopiero, gdy wpisany adres jest już co najmniej tak długi jak pierwszy (bez czerwieni w trakcie pisania).
  const showErr = mismatch && String(value).trim().length >= String(email).trim().length;
  return (
    <div>
      <label htmlFor={id} className={labelClassName || "mb-2 block text-[13px] font-medium text-exm-text"}>{label}</label>
      <input
        id={id}
        type="email"
        inputMode="email"
        required
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={block}
        onDrop={block}
        onCopy={block}
        aria-invalid={showErr || undefined}
        aria-describedby={`${id}-hint`}
        className={className}
      />
      {showErr ? (
        <p id={`${id}-hint`} className="mt-2 text-[13px] text-[#E8676A]" role="alert">Adresy się różnią. Sprawdź oba pola — na ten adres wyślę dostęp do materiałów.</p>
      ) : (
        <p id={`${id}-hint`} className="mt-2 text-[12px] leading-relaxed text-exm-muted">Wpisz adres jeszcze raz, ręcznie. To chroni przed literówką, przez którą materiały nie dotrą.</p>
      )}
    </div>
  );
}
