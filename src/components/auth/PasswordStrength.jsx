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
  if (!value) return <p className="text-xs text-foreground/55">Co najmniej 10 znaków.</p>;
  const s = strength(value);
  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={`h-[2px] flex-1 ${i <= s ? "bg-[#C9A24A]" : "bg-[#3D3D3F]"}`} />
        ))}
      </div>
      <p className="text-xs text-foreground/55">{LABELS[s]}{s === 0 && " — co najmniej 10 znaków"}</p>
    </div>
  );
}