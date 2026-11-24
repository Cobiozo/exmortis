import React from "react";
import { Link } from "react-router-dom";

// Bezpłatne konto w kasie — dobrowolne, domyślnie niezaznaczone (tylko dla niezalogowanych).
// Bez konta: materiały pod osobistym linkiem z maila (7 dni) i przycisk „Aktywuj konto” później.
// Kursy i wideo oglądasz na koncie — wtedy informacja, że aktywujesz je jednym kliknięciem w mailu.
// Treść zgody = ACCOUNT_TEXT w payuCreateOrder (rejestr zgód).
export const ACCOUNT_TEXT =
  "Załóż mi bezpłatne konto exmortis na podany adres: zakup zawsze pod ręką, ROZDROŻA, Biblioteka i 20 zł na kolejny materiał. Link do ustawienia hasła przyjdzie po zakupie.";

export default function AccountOption({ items, checked, onChange }) {
  const course = items.some((i) => ["kurs", "wideo", "zestaw"].includes(i.product_type));
  return (
    <div className="space-y-2">
      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-[#C9A24A] w-5 h-5 shrink-0 mt-0.5" />
        <span className="text-sm text-foreground/70 leading-relaxed">{ACCOUNT_TEXT}</span>
      </label>
      <p className="text-xs text-foreground/50 leading-relaxed pl-8">
        {course
          ? "Kursy, nagrania i e-booki z nagraniami są dostępne wyłącznie na bezpłatnym koncie. Jeśli nie zaznaczysz tej opcji, konto aktywujesz po zakupie jednym kliknięciem — link otrzymasz w wiadomości e-mail."
          : "Bez konta również otrzymasz pełny dostęp — link do pobrania materiałów otrzymasz w wiadomości e-mail."}{" "}
        Masz konto? <Link to="/login?returnTo=%2Fkasa" className="gold-text hover:underline">Zaloguj się</Link>.
      </p>
    </div>
  );
}