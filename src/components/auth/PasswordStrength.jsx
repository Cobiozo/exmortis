import React from "react";

const LABELS = ["Za krótkie", "Słabe", "Przyzwoite", "Dobre", "Mocne"];

export function strength(p) {
  if (p.length < 10) return 0;
  let s = 1;
  if (/[A-ZĄĆĘŁŃÓŚŹŻ]/.test(p) && /[a-ząćęłńóśźż]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^\w\s]/.test(p) || p.length >= 16) s++;
  return s;
}

export default function PasswordStrength({ value }) {
  if (!value) return <p className="text-[12px] text-exm-muted">Co najmniej 10 znaków.</p>;
  const s = strength(value);
  return (
    <div className="space-y-2" role="status" aria-live="polite">
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={`h-[2px] flex-1 ${i <= s ? "bg-exm-gold" : "bg-exm-line-strong"}`} />
        ))}
      </div>
      <p className="text-[12px] text-exm-muted">{LABELS[s]}{s === 0 && " — co najmniej 10 znaków"}</p>
    </div>
  );
}