import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { track } from "@/lib/track";

// Strona główna: krótka zapowiedź OBOK. Obok nie ma pozycji w menu — wejście z konta,
// a stąd zaproszenie do bezpłatnego konta (gość) albo prosto do zakładki Obok (zalogowany).
const KONTO_OBOK = "/konto?tab=obok";

export default function ObokHome() {
  const { user, isLoadingAuth } = useAuth();
  const zalogowany = !!user;
  const back = encodeURIComponent(KONTO_OBOK);
  return (
    <section aria-labelledby="home-obok-tytul" className="py-20 md:py-24 px-5 md:px-10 border-t hairline bg-[#0A0A0B]">
      <div className="mx-auto max-w-[1400px] grid md:grid-cols-12 gap-8 md:gap-16 items-end">
        <div className="md:col-span-7">
          <p className="technical text-[11px] gold-text mb-4">OBOK</p>
          <h2 id="home-obok-tytul" className="relic-heading text-[26px] sm:text-4xl leading-[1.08] text-[#F5EFE1] mb-6">
            Dobre słowo na wieczór.
          </h2>
          <p className="text-[17px] leading-[1.75] text-foreground/60 max-w-[40rem]">
            Obok — krótkie nagrania, dobre słowo i jedno pytanie na wieczór. Spokojne towarzyszenie między rozmowami, bez pośpiechu i bez oceniania.
          </p>
        </div>
        <div className="md:col-span-5 md:text-right">
          {zalogowany ? (
            <Link to={KONTO_OBOK} onClick={() => track("obok_home_click", { zalogowany: true })} className="btn-relic min-h-[44px]">
              PRZEJDŹ DO OBOK <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : (
            <div className="flex flex-wrap gap-4 md:justify-end">
              <Link to={`/register?returnTo=${back}`} onClick={() => track("obok_home_click", { zalogowany: false })} className="btn-relic min-h-[44px]">
                ZAŁÓŻ DARMOWE KONTO
              </Link>
              <Link to={`/login?returnTo=${back}`} className="btn-ghost min-h-[44px]">ZALOGUJ SIĘ</Link>
            </div>
          )}
          {!isLoadingAuth && <p className="technical text-[10px] text-foreground/40 mt-4">Bezpłatnie · Po założeniu konta</p>}
        </div>
      </div>
    </section>
  );
}
