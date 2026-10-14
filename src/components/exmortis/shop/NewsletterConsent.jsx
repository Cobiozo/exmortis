import React from "react";
import { Link } from "react-router-dom";

// Checkbox zgody na newsletter „Listy powrotu” — opcjonalny, domyślnie odznaczony.
export default function NewsletterConsent({ checked, onChange }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-[#C9A24A] w-5 h-5 shrink-0 mt-0.5"
      />
      <span className="text-xs text-foreground/55 leading-relaxed">
        Chcę dostawać Listy powrotu — jeden list w każdy poniedziałek. Mogę wypisać się w
        każdej chwili jednym kliknięciem. Szczegóły w{" "}
        <Link to="/polityka-prywatnosci" className="gold-text hover:underline">
          Polityce prywatności
        </Link>
        .
      </span>
    </label>
  );
}