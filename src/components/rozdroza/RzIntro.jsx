import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Logo from "@/components/exmortis/Logo";

// Ekran wejściowy: krótko, bez sekcji marketingowych.
export default function RzIntro() {
  return (
    <div className="max-w-[680px] mx-auto text-center">
      <Logo className="h-14 w-14 mx-auto" glow={false} />
      <p className="technical text-[11px] text-foreground/55 mt-5 tracking-[0.3em]">EXMORTIS</p>
      <p className="relic-heading text-4xl md:text-5xl gold-text mt-2 tracking-[0.12em]">ROZDROŻA</p>
      <p className="shop-heading italic text-foreground/55 mt-3">„Każda decyzja coś kończy. Każda coś zaczyna”.</p>
      <h1 className="shop-heading text-3xl md:text-4xl text-[#F5EFE1] mt-12">„Nie jesteś widzem tej historii”.</h1>
      <div className="mt-8 space-y-5 text-foreground/75 leading-[1.8] text-[17px] text-left sm:text-center">
        <p>Istnieją historie, w których wszystko wydaje się oczywiste, dopóki nie przychodzi moment wyboru.</p>
        <p>W ROZDROŻACH poznajesz ludzi stojących na granicy życiowej zmiany, czytasz ich historie, podejmujesz decyzje i odkrywasz, dokąd prowadzą.</p>
        <p>Nie ma tu punktów, zwycięzców ani jednej właściwej odpowiedzi. Są za to wybory, których konsekwencje potrafią zaskoczyć.</p>
        <p>Czasami zobaczysz w tych historiach coś znajomego. Czasami zrozumiesz, dlaczego ktoś postąpił zupełnie inaczej niż Ty.</p>
      </div>
      <Link to="/konto/rozdroza/biblioteka" className="btn-relic mt-10 focus-visible:ring-2 focus-visible:ring-[#C9A24A]/60">WEJDŹ W HISTORIĘ <ArrowRight className="h-4 w-4" /></Link>
      <section className="mt-16 border-t hairline pt-8 text-left" aria-labelledby="rz-czym">
        <h2 id="rz-czym" className="technical text-[11px] gold-text">CZYM SĄ ROZDROŻA?</h2>
        <p className="mt-4 text-sm text-foreground/60 leading-relaxed">ROZDROŻA to autorskie, interaktywne opowieści EXMORTIS. Ich bohaterowie mierzą się ze stratą, odpowiedzialnością, utratą sensu, zmianą i decyzjami, których nie można podjąć bez konsekwencji.</p>
        <p className="mt-3 text-sm text-foreground/60 leading-relaxed">To fikcja literacka, która zaprasza do refleksji. Nie jest terapią, formą diagnozy ani oceną Twoich wyborów.</p>
      </section>
    </div>
  );
}
