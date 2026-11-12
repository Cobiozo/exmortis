import React from "react";
import { Link } from "react-router-dom";
import { isDigital } from "@/components/account/accountUtils";

// Bezpłatne konto w kasie (tylko dla niezalogowanych).
// Treści cyfrowe i tak wymagają konta — wtedy zamiast pola wyboru jest informacja.
// Konto powstaje po opłaceniu zamówienia: na podany adres przychodzi link do ustawienia hasła.
export default function AccountOption({ items, checked, onChange }) {
  const digital = items.some(isDigital);
  const perks = "Biblioteka, ROZDROŻA i Twoje zakupy w jednym miejscu";
  if (digital) {
    return (
      <p className="text-xs text-foreground/55 leading-relaxed">
        Kupione materiały trafią do Twojego bezpłatnego konta exmortis ({perks}). Jeśli go nie masz, założę je na ten adres po
        zapłacie. Masz już konto? <Link to="/login?returnTo=%2Fkasa" className="gold-text hover:underline">Zaloguj się</Link>.
      </p>
    );
  }
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-[#C9A24A] w-5 h-5 shrink-0 mt-0.5"
      />
      <span className="text-xs text-foreground/55 leading-relaxed">
        Załóż mi bezpłatne konto exmortis: {perks}. Link do ustawienia hasła przyjdzie po zakupie.
      </span>
    </label>
  );
}
