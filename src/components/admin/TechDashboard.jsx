import React from "react";
import { Link } from "react-router-dom";

// Pulpit roli technicznej — bez liczników i list z danymi osobowymi.
export default function TechDashboard({ sections }) {
  return (
    <div className="space-y-6">
      <p className="text-foreground/60 text-sm max-w-xl">Rola techniczna: ustawienia, treści stron i wygląd. Zapisy, zgłoszenia, wyniki testu, subskrybenci, zamówienia i narzędzie RODO są niedostępne.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map(([k, title]) => (
          <Link key={k} to={`/admin/${k}`} className="border hairline p-6 hover:border-[#C9A24A] transition-colors">
            <p className="relic-heading text-xl">{title}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}