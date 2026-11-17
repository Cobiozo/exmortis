import React from "react";
import { Link } from "react-router-dom";
import { useFirma } from "@/lib/useSiteSettings";
import { addrOf } from "@/lib/firma";

// Dobrowolna gwarancja zwrotu 14 dni na produkty cyfrowe (17.11.2026, decyzja właściciela: gwarancja zostaje,
// z warunkami podanymi przed zakupem — Regulamin §16 ust. 1). Dane gwaranta z Ustawień → Firma.
export default function GuaranteeInfo({ className = "" }) {
  const f = useFirma();
  const email = f.email || "";
  const gwarant = [f.nazwa || f.osoba, addrOf(f)].filter(Boolean).join(", ");
  return (
    <details className={`border hairline px-4 py-3 text-sm text-foreground/70 ${className}`}>
      <summary className="cursor-pointer select-none text-foreground/80 hover:text-[#C9A24A] min-h-[28px]">
        Gwarancja 14 dni — warunki
      </summary>
      <ol className="list-decimal pl-5 mt-3 space-y-2 leading-relaxed">
        <li>Udzielam dobrowolnej gwarancji zwrotu ceny na produkty cyfrowe kupione w exmortis.pl (pliki PDF, nagrania, kursy).</li>
        <li>
          Jeśli w ciągu 14 dni od zakupu uznasz, że produkt nie spełnił Twoich oczekiwań, napisz
          {email ? <> na <a href={`mailto:${email}`} className="gold-text hover:underline">{email}</a></> : " do mnie"} i podaj numer zamówienia. Nie musisz podawać przyczyny.
        </li>
        <li>Zwracam pełną zapłaconą cenę w ciągu 14 dni od otrzymania wiadomości, tym samym sposobem płatności, chyba że wskażesz inny, bezpłatny dla Ciebie sposób.</li>
        <li>Po zwrocie dostęp do produktu zostaje wyłączony.</li>
        <li>Gwarancja nie obejmuje usług (sesji 1:1, programu POWRÓT, wydarzeń) ani kart podarunkowych.</li>
        <li>Gwarantem jest {gwarant || "Sprzedawca wskazany w Regulaminie"}. Gwarancja obowiązuje bez ograniczeń terytorialnych.</li>
        <li>
          Gwarancja nie wyłącza, nie ogranicza ani nie zawiesza Twoich uprawnień wynikających z przepisów, w tym w razie niezgodności produktu z umową
          i prawa odstąpienia od umowy — <Link to="/regulamin" className="gold-text hover:underline">Regulamin</Link> §14–§16.
        </li>
      </ol>
    </details>
  );
}
