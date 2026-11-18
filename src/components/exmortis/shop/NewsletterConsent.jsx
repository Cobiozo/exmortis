import React from "react";
import { Link } from "react-router-dom";
import { TXT } from "@/content/legal/seller";

// Checkbox zgody na newsletter „Listy powrotu” — opcjonalny, domyślnie odznaczony.
export default function NewsletterConsent({ checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-[#C9A24A]"
      />
      <span className="text-[13px] leading-relaxed text-exm-muted">
        {TXT.newsletter} Szczegóły w{" "}
        <Link to="/polityka-prywatnosci" className="gold-text hover:underline">
          Polityce prywatności
        </Link>
        .
      </span>
    </label>
  );
}