import React from "react";
import PodcastGuestForm from "./PodcastGuestForm";
import Container from "@/components/exmortis/ui/Container";

const Box = ({ title, children }) => (
  <div className="border-l border-exm-gold-line pl-5">
    <p className="exm-eyebrow mb-2">{title}</p>
    <p className="text-[15px] leading-relaxed text-exm-muted">{children}</p>
  </div>
);

// Zostań gościem podcastu — dotychczasowa treść i formularz w jednej karcie na końcu strony.
export default function PodcastGuest() {
  return (
    <section id="gosc-podcastu" className="py-[var(--exm-section-y)]">
      <Container>
        <div className="rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface p-5 md:p-10">
          <p className="exm-eyebrow mb-3">Zostań gościem podcastu</p>
          <h2 className="exm-h2 max-w-[26ch]">Twoja droga może komuś pomóc wrócić</h2>

          <div className="mt-8 grid gap-8 md:grid-cols-2 md:gap-12">
            <div className="min-w-0 space-y-8">
              <div className="space-y-4 text-[15px] leading-relaxed text-exm-muted">
                <p>Szukam ludzi, którzy przeszli przez wypalenie, utratę sensu albo stratę — i wrócili inni. Nie potrzebuję historii z happy endem. Potrzebuję prawdziwej.</p>
                <p>Rozmawiamy online, ok. 60 minut. Możesz wystąpić pod imieniem, pseudonimem albo anonimowo.</p>
              </div>
              <Box title="ZANIM SIĘ ZGŁOSISZ">
                Ten podcast jest dla historii, które mają już za sobą najostrzejszy moment. Jeśli jesteś teraz w kryzysie — najpierw zadbaj o siebie:{" "}
                <span className="text-exm-ivory">116 123 · 800 70 2222</span> (całą dobę, bezpłatnie) · <span className="text-exm-ivory">112</span>. Twoja historia poczeka.
              </Box>
              <Box title="CO WYDARZY SIĘ DALEJ">
                Każde zgłoszenie czytam sam. Odpowiadam w ciągu 14 dni — także wtedy, gdy rozmowa nie dojdzie do skutku. Przed nagraniem jest krótka rozmowa wstępna (ok. 15 minut). Nic nie trafi do sieci bez Twojej pisemnej zgody, a przed publikacją możesz poprosić o wycięcie fragmentu, który okazał się zbyt osobisty.
              </Box>
            </div>
            <div className="min-w-0">
              <PodcastGuestForm />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}