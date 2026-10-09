import React from "react";
import { Link } from "react-router-dom";
import { useSiteContent } from "@/components/exmortis/SiteContentProvider";
import Logo from "./Logo";
import FooterColumns from "./footer/FooterColumns";
import CompanyLines from "@/components/legal/CompanyLines";
import usePrelaunch from "@/lib/usePrelaunch";
import { openCookieSettings } from "@/components/legal/cookieStore";

export default function Footer() {
  const { rich } = useSiteContent();
  const { gated } = usePrelaunch();
  const aboutText = rich("footer", "about", "Wracam z siebie. Uczę wracać. Głos powrotu ze śmierci mentalnej, duchowej i życiowej. Nie musisz być silny, żeby wrócić. Musisz zrobić pierwszy ruch.");

  return (
    <footer className="relative bg-[#0A0A0B] border-t hairline overflow-hidden">
      {/* Blood-trail top line */}
      <div className="absolute top-0 left-0 right-0 h-px spine" />

      <div className="mx-auto max-w-[1400px] px-5 md:px-10 py-20 md:py-28">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-12 lg:gap-16">
          <div>
            <div className="flex items-center gap-3 mb-5">
              <Logo className="h-12 w-12" glow={false} />
              <span className="relic-heading text-2xl gold-text tracking-[0.3em]">EXMORTIS</span>
            </div>
            <div className="rich-content text-foreground/50 max-w-sm leading-relaxed text-sm" dangerouslySetInnerHTML={{ __html: aboutText }} />
          </div>

          {!gated && <FooterColumns />}
        </div>

        <div className="mt-16 pt-8 border-t hairline">
          <p className="text-xs text-foreground/40 leading-relaxed max-w-2xl mb-6">
            exmortis to mentoring, nie terapia. Jeśli jest Ci bardzo ciężko:{" "}
            <span className="gold-text">116 123</span> · <span className="gold-text">800 70 2222</span> (całą dobę,
            bezpłatnie) · w zagrożeniu życia <span className="gold-text">112</span>.
          </p>
          <nav aria-label="Dokumenty" className="flex flex-wrap gap-x-5 gap-y-2 text-xs mb-4">
            <Link to="/regulamin" className="text-foreground/60 hover:gold-text">Regulamin</Link>
            <Link to="/polityka-prywatnosci" className="text-foreground/60 hover:gold-text">Polityka prywatności</Link>
            <Link to="/polityka-cookies" className="text-foreground/60 hover:gold-text">Polityka cookies</Link>
            <Link to="/odstapienie" className="text-foreground/60 hover:gold-text">Odstąp od umowy tutaj</Link>
            <button onClick={openCookieSettings} className="text-foreground/60 hover:gold-text">Ustawienia cookies</button>
            <Link to="/kontakt" className="text-foreground/60 hover:gold-text">Kontakt</Link>
          </nav>
          <CompanyLines className="text-[11px] text-foreground/35 mb-6" />
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <p className="technical text-[10px] text-foreground/30">
              © {new Date().getFullYear()} EXMORTIS · WSZELKIE PRAWA ZASTRZEŻONE
            </p>
            <p className="technical text-[10px] text-foreground/30">
              WRACAM Z SIEBIE · UCZĘ WRACAĆ
              <Link to="/login?returnTo=%2Fadmin" className="ml-4 text-foreground/25 hover:text-foreground/50">ZALOGUJ</Link>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}