import React from "react";
import PodcastGuestForm from "./PodcastGuestForm";

const Box = ({ title, children }) => (
  <div className="border-l border-[#C9A24A]/40 pl-6">
    <p className="technical text-[10px] gold-text mb-3">{title}</p>
    <p className="text-sm leading-relaxed text-foreground/65">{children}</p>
  </div>
);

export default function PodcastGuest() {
  return (
    <section id="gosc-podcastu" className="py-32 px-5 md:px-10 border-t hairline bg-[#070708] overflow-hidden">
      <div className="mx-auto max-w-[1400px]">
        <p className="technical text-[11px] gold-text mb-4">GOŚĆ PODCASTU · 04</p>
        <h2 className="relic-heading max-w-[18ch] mb-12 break-words" style={{ fontSize: "clamp(2rem, 6vw, 4.5rem)", textWrap: "balance" }}>
          <span className="text-[#F5EFE1]">Twoja droga</span><br />
          <span className="gold-text">może komuś pomóc wrócić</span>
        </h2>

        <div className="grid md:grid-cols-2 gap-12 md:gap-20">
          <div className="space-y-10 text-foreground/65 leading-relaxed max-w-xl">
            <div className="space-y-5">
              <p>Szukam ludzi, którzy przeszli przez wypalenie, utratę sensu albo stratę — i wrócili inni. Nie potrzebuję historii z happy endem. Potrzebuję prawdziwej.</p>
              <p>Rozmawiamy online, ok. 60 minut. Możesz wystąpić pod imieniem, pseudonimem albo anonimowo.</p>
            </div>
            <Box title="ZANIM SIĘ ZGŁOSISZ">
              Ten podcast jest dla historii, które mają już za sobą najostrzejszy moment. Jeśli jesteś teraz w kryzysie — najpierw zadbaj o siebie:{" "}
              <span className="text-[#F5EFE1]">116 123 · 800 70 2222</span> (całą dobę, bezpłatnie) · <span className="text-[#F5EFE1]">112</span>. Twoja historia poczeka.
            </Box>
            <Box title="CO WYDARZY SIĘ DALEJ">
              Każde zgłoszenie czytam sam. Odpowiadam w ciągu 14 dni — także wtedy, gdy rozmowa nie dojdzie do skutku. Przed nagraniem jest krótka rozmowa wstępna (ok. 15 minut). Nic nie trafi do sieci bez Twojej pisemnej zgody, a przed publikacją możesz poprosić o wycięcie fragmentu, który okazał się zbyt osobisty.
            </Box>
          </div>
          <PodcastGuestForm />
        </div>
      </div>
    </section>
  );
}