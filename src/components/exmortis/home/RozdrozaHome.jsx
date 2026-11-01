import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Image } from "@/components/ui/image";
import { useAuth } from "@/lib/AuthContext";
import { track } from "@/lib/track";

// Strona główna: ROZDROŻA — interaktywne historie (między „Drogą powrotu" a „POWRÓT").
// Prawa kolumna: okładki historii JUŻ opublikowanych i widocznych dla klientów (żadna z zaplanowanych).
// Aktualizacja: podmienić adresy i podpisy na okładki nowszych opublikowanych historii.
const COVERS = [
  {
    src: "https://base44.app/api/apps/6aa08bc6318b0f886cc3b9a3/files/mp/public/6aa08bc6318b0f886cc3b9a3/ef0beaa83_rozdroza-1792018375708.png",
    alt: "Okładka interaktywnej historii „DWA ZNICZE”",
  },
  {
    src: "https://base44.app/api/apps/6aa08bc6318b0f886cc3b9a3/files/mp/public/6aa08bc6318b0f886cc3b9a3/a43549c3a_rozdroza-1791817987523.png",
    alt: "Okładka interaktywnej historii „Zastępstwo”",
  },
  {
    src: "https://base44.app/api/apps/6aa08bc6318b0f886cc3b9a3/files/mp/public/6aa08bc6318b0f886cc3b9a3/0eb2758b2_rozdroza-1791817497017.png",
    alt: "Okładka interaktywnej historii „Człowiek od odpowiedzi”",
  },
];

// Biblioteka ROZDROŻY w koncie klienta. Gość wraca tu po zalogowaniu (returnTo sprawdza lib/authReturnTo).
const BIBLIOTEKA = "/konto/rozdroza/biblioteka";
const LOGIN_TO = `/login?returnTo=${encodeURIComponent(BIBLIOTEKA)}`;

export default function RozdrozaHome() {
  const { user, isLoadingAuth } = useAuth();
  const ref = React.useRef(null);
  const seen = React.useRef(false);

  // Pomiar: widok sekcji raz na wejście w ekran (bez danych osobowych i bez treści wyborów).
  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (seen.current || !entries.some((e) => e.isIntersecting)) return;
      seen.current = true;
      track("rozdroza_view");
      io.disconnect();
    }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const zalogowany = !!user;

  return (
    <section ref={ref} aria-labelledby="home-rozdroza-tytul" className="relative py-24 md:py-32 px-5 md:px-10 border-t hairline bg-[#0A0A0B]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(ellipse_at_right,rgba(92,26,27,0.35),transparent_65%)]" />
      <div className="relative mx-auto max-w-[1400px] grid md:grid-cols-12 gap-12 lg:gap-16 items-center">
        <div className="md:col-span-7">
          <p className="technical text-[11px] gold-text mb-4">ROZDROŻA / INTERAKTYWNE HISTORIE</p>
          <h2 id="home-rozdroza-tytul" className="relic-heading text-[26px] sm:text-4xl lg:text-[2.9rem] leading-[1.06] text-[#F5EFE1] mb-8 max-w-[46rem]">
            A gdybyś mógł zobaczyć, dokąd prowadzi inna decyzja?
          </h2>

          <div className="space-y-5 text-[17px] leading-[1.75] text-foreground/60 max-w-[40rem]">
            <p>Są chwile, kiedy człowiek musi wybierać, choć nie zna jeszcze całej prawdy. Każda możliwość coś zmienia. Każda może mieć swoją cenę.</p>
            <p className="shop-heading italic text-[20px] md:text-[23px] leading-snug text-[#F5EFE1]">
              ROZDROŻA to interaktywne historie EXMORTIS, w których nie jesteś tylko czytelnikiem.
            </p>
            <p>Poznajesz bohaterów, ich relacje, konflikty i trudne życiowe sytuacje. W kluczowych momentach to Ty podejmujesz decyzje, które wpływają na dalszy przebieg opowieści.</p>
            <p>Możesz wrócić do wcześniejszego wyboru. Sprawdzić inną możliwość. Zobaczyć odmienne zakończenie.</p>
            <p>Nie chodzi o znalezienie jednej poprawnej odpowiedzi. Chodzi o dostrzeżenie tego, jak bardzo zmienia się nasze spojrzenie, kiedy poznajemy więcej niż jedną perspektywę.</p>
          </div>

          <p className="mt-8 border-l-2 border-[#C9A24A] pl-4 text-[15px] leading-relaxed text-foreground/75">
            <strong className="font-semibold text-[#F5EFE1]">101 przygotowanych historii.</strong> Kolejna publikowana w każdy piątek o 15:00 oraz okolicznościowo
          </p>

          <div className="mt-9">
            {/* Zalogowany → biblioteka ROZDROŻY w koncie. Gość → logowanie z powrotem do biblioteki. */}
            {zalogowany ? (
              <Link to={BIBLIOTEKA} onClick={() => track("rozdroza_cta_click", { zalogowany: true })}
                className="btn-relic min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A24A]">
                ODKRYJ ROZDROŻA <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            ) : (
              <Link to={LOGIN_TO} onClick={() => track("rozdroza_cta_click", { zalogowany: false })}
                className="btn-relic min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A24A]">
                ODKRYJ ROZDROŻA <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            )}

            {!zalogowany && !isLoadingAuth && (
              <p className="mt-4 text-sm text-foreground/55 max-w-[34rem] leading-relaxed">
                ROZDROŻA są bezpłatne. Zaloguj się lub załóż konto EXMORTIS, aby odkrywać interaktywne historie.
              </p>
            )}
            <p className="technical text-[10px] text-foreground/40 mt-4">Bezpłatnie · Dostęp po zalogowaniu lub założeniu konta</p>
          </div>
        </div>

        {/* Okładki opublikowanych historii — nic z przyszłych publikacji. */}
        <div className="md:col-span-5">
          <ul className="grid grid-cols-3 gap-3 md:gap-4">
            {COVERS.map((c, i) => (
              <li key={c.src} className={`relative overflow-hidden border hairline bg-[#070708] ${i === 1 ? "md:-mt-6" : ""}`}>
                <Image src={c.src} alt={c.alt} fittingType="fill" className="block w-full aspect-[2/3]" />
                <span aria-hidden="true" className="pointer-events-none absolute inset-0 border border-[#C9A24A]/25" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}