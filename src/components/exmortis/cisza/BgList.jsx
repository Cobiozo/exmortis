import React from "react";
import { Check } from "lucide-react";

// Lista teł dźwiękowych dla wybranego czasu + "Bez muzyki".
export default function BgList({ tracks, value, onChange }) {
  const options = [
    ...tracks.map((t) => ({ id: t.id, label: t.opis ? `${t.nazwa} · ${t.opis}` : t.nazwa })),
    { id: "none", label: "Bez muzyki (tylko wstęp i zakończenie)" },
  ];
  return (
    <ul className="border border-[#C9A24A]/30 bg-[#0A0A0B] py-2 min-w-[240px]" role="listbox" aria-label="Tło dźwiękowe">
      {options.map((o) => (
        <li key={o.id}>
          <button
            role="option"
            aria-selected={value === o.id}
            onClick={() => onChange(o.id)}
            className={`w-full flex items-center justify-between gap-4 px-4 py-2.5 text-left text-sm ${
              value === o.id ? "text-[#C9A24A]" : "text-[#F5EFE1]/70 hover:text-[#F5EFE1]"
            }`}
          >
            {o.label}
            {value === o.id && <Check className="h-4 w-4" strokeWidth={1.25} />}
          </button>
        </li>
      ))}
    </ul>
  );
}