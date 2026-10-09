import React from "react";
import { Link } from "react-router-dom";

// Brak dostępu / jeszcze zamknięte / trzeba się zalogować.
export default function ObokDenied({ info }) {
  const here = encodeURIComponent(window.location.pathname);
  const login = info?.error === "Zaloguj się";
  return (
    <section className="min-h-[70svh] flex items-center px-5 md:px-10 pt-32 pb-24">
      <div className="mx-auto max-w-[60ch]">
        <p className="relic-heading text-2xl text-[#F5EFE1] mb-4">{login ? "To miejsce jest dla osób z kontem." : info?.error || "Brak dostępu."}</p>
        <div className="flex flex-wrap gap-4 mt-8">
          {login ? <Link to={`/login?returnTo=${here}`} className="btn-relic">Zaloguj się</Link>
            : info?.seria?.landing ? <Link to={`/${info.seria.landing}`} className="btn-relic">Dołącz do serii</Link> : null}
          <Link to="/obok" className="btn-ghost">Wróć do Obok</Link>
        </div>
      </div>
    </section>
  );
}