import React from "react";
import PodcastGuestForm from "./PodcastGuestForm";

export default function PodcastGuest() {
  return (
    <section id="gosc-podcastu" className="py-32 px-5 md:px-10 border-t hairline bg-[#070708]">
      <div className="mx-auto max-w-[1400px]">
        <p className="technical text-[11px] gold-text mb-4">GOŚĆ PODCASTU · 04</p>
        <h2 className="relic-heading text-4xl md:text-6xl leading-[0.95] mb-12">
          Podziel się swoją drogą —<br />
          <span className="gold-text">zostań gościem naszego podcastu</span>
        </h2>

        <div className="grid md:grid-cols-2 gap-12 md:gap-20">
          <div className="space-y-6 text-foreground/60 leading-relaxed">
            <p>
              Czy masz za sobą trudną drogę i chcesz opowiedzieć o swoim powrocie? Wierzymy,
              że każda historia transformacji, pokonywania przeciwności i odnajdywania
              własnej ścieżki ma ogromną moc.
            </p>
            <p>
              Jeśli czujesz gotowość, by zainspirować innych swoim doświadczeniem,
              serdecznie zapraszamy do udziału w naszym podcaście.
            </p>
            <div className="border-l hairline pl-6 pt-4 mt-10">
              <p className="technical text-[10px] text-foreground/40 mb-4">
                CO WYDARZY SIĘ DALEJ?
              </p>
              <p className="text-sm leading-relaxed">
                <span className="text-foreground/80">Poufność i kontakt:</span> gwarantuję
                pełną poufność wszystkich przekazanych informacji. Uważnie czytam każdą
                historię, jednak ze względów logistycznych zastrzegam, że skontaktuję się
                z wybranymi osobami w celu umówienia terminu nagrania.
              </p>
              <p className="text-sm gold-text pt-4 leading-relaxed">
                Dziękuję za odwagę i zaufanie. Czekam na Twoją historię!
              </p>
            </div>
          </div>
          <PodcastGuestForm />
        </div>
      </div>
    </section>
  );
}