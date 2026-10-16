import React from "react";
import { useFirma } from "@/lib/useSiteSettings";

// Dane firmy — tylko wypełnione pola. variant: "line" (jedna linia) albo "block" (strona Kontakt).
export default function CompanyLines({ variant = "line", className = "" }) {
  const f = useFirma();
  // Gdy nazwa firmy to ta sama osoba (działalność jednoosobowa), nie powtarzam jej w drugiej linii.
  const main = [f.nazwa !== f.osoba && f.nazwa, f.adres, f.nip && `NIP ${f.nip}`, f.regon && `REGON ${f.regon}`].filter(Boolean).join(", ");
  if (variant === "line") return main ? <p className={className}>{main}</p> : null;
  return (
    <div className={className}>
      {f.osoba && <p className="text-foreground/75 mb-2">{f.osoba}</p>}
      {main && <p className="text-foreground/75 leading-relaxed mb-2">{main}</p>}
      {f.email && <p className="text-foreground/75 mb-2">E-mail: <a href={`mailto:${f.email}`} className="gold-text">{f.email}</a></p>}
      {f.telefon && <p className="text-foreground/75 mb-2">Telefon: {f.telefon}</p>}
      {f.korespondencja && <p className="text-foreground/75 mb-2">Adres do korespondencji: {f.korespondencja}</p>}
    </div>
  );
}