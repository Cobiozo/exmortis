import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { HeartHandshake, SlidersHorizontal } from "lucide-react";
import { useSiteContent } from "@/components/exmortis/SiteContentProvider";
import { useCrisis } from "@/components/crisis/CrisisContext";
import Logo from "./Logo";
import FooterColumns from "./footer/FooterColumns";
import usePrelaunch from "@/lib/usePrelaunch";
import { openCookieSettings } from "@/components/legal/cookieStore";
import { sanitizeHtml } from "@/lib/sanitizeHtml";

// Wspólna stopka (5.11.2026): marka + trzy grupy linków, pas pomocy, dokumenty, dolna linia.
// Jedna dla wszystkich stron w Layout; Minutnik ciszy (/cisza) jest poza Layout i zostaje bez stopki.
// Dane firmy tylko na stronie Kontakt i w dokumentach prawnych (decyzja 4.11.2026).
const LEGAL = [["/regulamin", "Regulamin"], ["/polityka-prywatnosci", "Polityka prywatności"], ["/polityka-cookies", "Polityka cookies"],
  ["/odstapienie", "Odstąp od umowy tutaj"], ["/kontakt", "Kontakt"]];
const LEGAL_CLS = "min-h-[44px] inline-flex items-center text-sm text-[#F5EFE1]/75 hover:text-[#C9A24A] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A24A]";
const TEL = "underline decoration-[#C9A24A]/60 underline-offset-4 hover:text-[#C9A24A] whitespace-nowrap";

export default function Footer() {
  const { rich } = useSiteContent();
  const { gated } = usePrelaunch();
  const { open: openCrisis, isOpen } = useCrisis();
  // Po zamknięciu panelu pomocy otwartego ze stopki fokus wraca na przycisk.
  const helpBtn = useRef(null);
  const fromFooter = useRef(false);
  useEffect(() => {
    if (!isOpen && fromFooter.current) { fromFooter.current = false; helpBtn.current?.focus(); }
  }, [isOpen]);
  const opis = rich("footer", "opis", "Słowa, historie i spotkania na Twoją drogę powrotu.");

  return (
    <footer className="relative bg-[#0A0A0B] border-t hairline pb-16 md:pb-0">
      <div className="absolute top-0 left-0 right-0 h-px spine" aria-hidden="true" />

      <div className="mx-auto max-w-[1400px] px-5 md:px-10 pt-12 md:pt-14 pb-8">
        {/* 1. Marka + grupy linków */}
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] lg:gap-16 pb-10 md:pb-12">
          <div className="min-w-0">
            <Link to="/" className="inline-flex items-center gap-3 mb-6 min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A24A]" aria-label="EXMORTIS — strona główna">
              <Logo className="h-11 w-11" glow={false} />
              <span className="relic-heading text-2xl gold-text tracking-[0.3em]">EXMORTIS</span>
            </Link>
            <p className="shop-heading text-2xl md:text-[1.7rem] leading-snug text-[#F5EFE1]">Wracam z siebie.<br />Uczę wracać.</p>
            <div className="rich-content text-base text-[#F5EFE1]/75 leading-relaxed mt-4 max-w-[30ch]" dangerouslySetInnerHTML={{ __html: sanitizeHtml(opis) }} />
          </div>
          {!gated && <FooterColumns />}
        </div>

        {/* 2. Pas pomocy — zawsze widoczny, bez konta i bez zgód cookies */}
        <section aria-label="Pomoc" className="border-t hairline py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="flex gap-3 min-w-0">
            <HeartHandshake className="h-5 w-5 shrink-0 mt-0.5 gold-text" aria-hidden="true" />
            <div className="text-sm leading-relaxed text-[#F5EFE1]/80">
              <p className="text-[#F5EFE1]">EXMORTIS to mentoring i rozwój. Nie zastępuje terapii ani pomocy medycznej.</p>
              <p className="mt-1">
                Jeśli jest Ci bardzo ciężko: <a href="tel:116123" className={TEL}>116 123</a> · <a href="tel:800702222" className={TEL}>800 70 2222</a>{" "}
                (całą dobę, bezpłatnie) · w zagrożeniu życia <a href="tel:112" className={TEL}>112</a>.
              </p>
            </div>
          </div>
          <button ref={helpBtn} type="button" onClick={() => { fromFooter.current = true; openCrisis(); }}
            className="self-start md:self-center shrink-0 inline-flex items-center gap-2 min-h-[44px] px-5 border border-[#C9A24A]/60 text-sm text-[#F5EFE1] hover:bg-[#C9A24A]/10 transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A24A]">
            <HeartHandshake className="h-4 w-4 gold-text" aria-hidden="true" />
            Pomoc w kryzysie
          </button>
        </section>

        {/* 3. Dokumenty i prywatność */}
        <nav aria-label="Dokumenty i prywatność" className="border-t hairline py-3 flex flex-wrap gap-x-6 gap-y-0">
          {LEGAL.map(([to, t]) => <Link key={to} to={to} className={LEGAL_CLS}>{t}</Link>)}
          <button type="button" onClick={openCookieSettings} className={`${LEGAL_CLS} gap-2 text-left`}>
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Ustawienia cookies
          </button>
        </nav>

        {/* 4. Dolna linia */}
        <div className="border-t hairline pt-5 flex flex-col sm:flex-row sm:justify-between gap-2 text-sm text-[#F5EFE1]/70">
          <p>© {new Date().getFullYear()} EXMORTIS</p>
          <p>Wszelkie prawa zastrzeżone.</p>
        </div>
      </div>
    </footer>
  );
}
