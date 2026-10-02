import React from "react";
import { Link } from "react-router-dom";
import { useSiteContent } from "@/components/exmortis/SiteContentProvider";
import Logo from "./Logo";

export default function Footer() {
  const { rich } = useSiteContent();
  const aboutText = rich("footer", "about", "Wracam z siebie. Uczę wracać. Głos powrotu ze śmierci mentalnej, duchowej i życiowej. Nie musisz być silny, żeby wrócić. Musisz zrobić pierwszy ruch.");

  return (
    <footer className="relative bg-[#0A0A0B] border-t hairline overflow-hidden">
      {/* Blood-trail top line */}
      <div className="absolute top-0 left-0 right-0 h-px spine" />

      <div className="mx-auto max-w-[1400px] px-5 md:px-10 py-20 md:py-28">
        <div className="grid md:grid-cols-4 gap-10">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-5">
              <Logo className="h-12 w-12" glow={false} />
              <span className="relic-heading text-2xl gold-text tracking-[0.3em]">EXMORTIS</span>
            </div>
            <div className="rich-content text-foreground/50 max-w-sm leading-relaxed text-sm" dangerouslySetInnerHTML={{ __html: aboutText }} />
          </div>

          <div>
            <p className="technical text-[10px] text-foreground/40 mb-5">Nawigacja</p>
            <ul className="space-y-3 text-sm">
              <li><Link to="/" className="text-foreground/70 hover:gold-text transition-colors">Powrót</Link></li>
              <li><Link to="/o-mnie" className="text-foreground/70 hover:gold-text transition-colors">O mnie</Link></li>
              <li><Link to="/glos?src=footer" className="text-foreground/70 hover:gold-text transition-colors">Głos</Link></li>
              <li><Link to="/sklep" className="text-foreground/70 hover:gold-text transition-colors">Skarbiec</Link></li>
              <li><Link to="/test?src=footer" className="text-foreground/70 hover:gold-text transition-colors">Test: która śmierć jest Twoja?</Link></li>
              <li><Link to="/cisza?src=footer" className="text-foreground/70 hover:gold-text transition-colors">Chwila ciszy</Link></li>
              <li><Link to="/spotkania?src=footer" className="text-foreground/70 hover:gold-text transition-colors">Spotkania</Link></li>
              <li><a href="#manifest" className="text-foreground/70 hover:gold-text transition-colors">Manifest</a></li>
            </ul>
          </div>

          <div>
            <p className="technical text-[10px] text-foreground/40 mb-5">Kontakt</p>
            <ul className="space-y-3 text-sm">
              <li><a href="mailto:kontakt@exmortis.pl" className="text-foreground/70 hover:gold-text transition-colors">kontakt@exmortis.pl</a></li>
              <li><a href="https://www.instagram.com/e.x.m.o.r.t.i.s/" target="_blank" rel="noreferrer" className="text-foreground/70 hover:gold-text transition-colors">Instagram</a></li>
              <li><a href="https://www.facebook.com/dawidkowalczyk.exmortis" target="_blank" rel="noreferrer" className="text-foreground/70 hover:gold-text transition-colors">Facebook</a></li>
              <li><a href="https://www.youtube.com/@e.x.m.o.r.t.i.s" target="_blank" rel="noreferrer" className="text-foreground/70 hover:gold-text transition-colors">YouTube</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t hairline">
          <p className="text-xs text-foreground/40 leading-relaxed max-w-2xl mb-6">
            exmortis to mentoring, nie terapia. Jeśli jest Ci bardzo ciężko:{" "}
            <span className="gold-text">116 123</span> · <span className="gold-text">800 70 2222</span> (całą dobę,
            bezpłatnie) · w zagrożeniu życia <span className="gold-text">112</span>.
          </p>
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <p className="technical text-[10px] text-foreground/30">
              © {new Date().getFullYear()} EXMORTIS · WSZELKIE PRAWA ZASTRZEŻONE
            </p>
            <p className="technical text-[10px] text-foreground/30">
              WRACAM Z SIEBIE · UCZĘ WRACAĆ
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}