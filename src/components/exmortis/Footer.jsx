import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useSiteContent } from "@/components/exmortis/SiteContentProvider";
import Logo from "./Logo";
import FooterColumns from "./footer/FooterColumns";
import CompanyLines from "@/components/legal/CompanyLines";
import usePrelaunch from "@/lib/usePrelaunch";
import { openCookieSettings } from "@/components/legal/cookieStore";
import { linkPhones } from "@/lib/phones";
import { sanitizeHtml } from "@/lib/sanitizeHtml";

export default function Footer() {
  const { rich } = useSiteContent();
  const { gated } = usePrelaunch();
  const aboutText = rich("footer", "about", "Wracam z siebie. Uczę wracać. Głos powrotu ze śmierci mentalnej, duchowej i życiowej. Siła nie jest warunkiem powrotu. Wystarczy pierwszy ruch.");
  const { pathname, search } = useLocation();

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
            <div className="rich-content text-foreground/55 max-w-sm leading-relaxed text-sm" dangerouslySetInnerHTML={{ __html: sanitizeHtml(aboutText) }} />
          </div>

          {!gated && <FooterColumns />}
        </div>

        <div className="mt-16 pt-8 border-t hairline">
          <p className="text-sm text-foreground/85 leading-relaxed max-w-2xl mb-6"
            dangerouslySetInnerHTML={{ __html: linkPhones("exmortis to mentoring, nie terapia. Jeśli jest Ci bardzo ciężko: 116 123 · 800 70 2222 (całą dobę, bezpłatnie) · w zagrożeniu życia 112.") }} />
          <nav aria-label="Dokumenty" className="flex flex-col sm:flex-row sm:flex-wrap sm:gap-x-5 text-sm mb-4">
            {[["/regulamin", "Regulamin"], ["/polityka-prywatnosci", "Polityka prywatności"], ["/polityka-cookies", "Polityka cookies"], ["/odstapienie", "Odstąp od umowy tutaj"], ["/kontakt", "Kontakt"]].map(([to, t]) => (
              <Link key={to} to={to} className="min-h-[44px] flex items-center text-foreground/75 hover:gold-text">{t}</Link>
            ))}
            <button onClick={openCookieSettings} className="min-h-[44px] flex items-center text-left text-foreground/75 hover:gold-text">Ustawienia cookies</button>
          </nav>
          <CompanyLines className="text-xs text-foreground/65 mb-6" />
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <p className="technical text-xs text-foreground/65">
              © {new Date().getFullYear()} EXMORTIS · WSZELKIE PRAWA ZASTRZEŻONE
            </p>
            <p className="technical text-xs text-foreground/65 flex flex-wrap items-center">
              WRACAM Z SIEBIE · UCZĘ WRACAĆ
              {!gated && <Link to={`/login?returnTo=${encodeURIComponent(pathname + search)}`} className="ml-4 min-h-[44px] inline-flex items-center text-foreground/65 hover:gold-text">ZALOGUJ</Link>}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}