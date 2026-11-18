import React from "react";
import { Search } from "lucide-react";

// Wyszukiwarka biblioteki z widoczną etykietą (nie tylko placeholder).
export default function GlosSearch({ id, label, value, onChange, placeholder }) {
  return (
    <div className="w-full sm:max-w-sm">
      <label htmlFor={id} className="exm-eyebrow mb-2 block">
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-[var(--exm-r-field)] border border-exm-line bg-exm-bg px-3 focus-within:border-exm-gold-line">
        <Search className="h-4 w-4 shrink-0 text-exm-muted" aria-hidden="true" />
        <input
          id={id}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent py-3 text-exm-text placeholder:text-exm-muted focus:outline-none"
        />
      </div>
    </div>
  );
}