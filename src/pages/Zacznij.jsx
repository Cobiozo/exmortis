import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { EXCLUDED_SLUGS } from "@/components/exmortis/shop/cardBits";
import WhatsAppChannelLink from "@/components/exmortis/WhatsAppChannelLink";
import { useAuth } from "@/lib/AuthContext";

// „Zacznij bezpłatnie” (audyt 17.11.2026, X-39): jedno wejście do wszystkiego, co na exmortis.pl jest bezpłatne.
// Nic tu nie zmienia dostępu do materiałów — strona tylko zbiera istniejące drogi w jednym miejscu.
// Bezpłatne PDF-y czytane na żywo ze Skarbca (produkty „bezpłatne” i dostępne), reszta to stałe odnośniki.
const ROZDROZA = "/konto/rozdroza/biblioteka";

function Item({ to, title, text, meta, cta }) {
  return (
    <Link to={to} className="group flex flex-col border hairline bg-[#070708] p-6 md:p-8 hover:border-[#C9A24A] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A24A]">
      {meta && <p className="technical text-[10px] text-foreground/55 mb-3">{meta}</p>}
      <h3 className="relic-heading text-2xl leading-[1.05] mb-3 group-hover:text-[#C9A24A] transition-colors">{title}</h3>
      <p className="text-foreground/70 leading-relaxed flex-1">{text}</p>
      <span className="technical text-[11px] gold-text mt-6 inline-flex items-center gap-2">{cta} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></span>
    </Link>
  );
}

function Group({ label, title, children }) {
  return (
    <section className="py-12 md:py-16 border-t hairline">
      <p className="technical text-[11px] gold-text mb-3">{label}</p>
      <h2 className="relic-heading text-3xl md:text-4xl leading-[1] mb-8">{title}</h2>
      <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3 items-stretch">{children}</div>
    </section>
  );
}

export default function Zacznij() {
  const { user } = useAuth();
  const [pdfs, setPdfs] = useState([]);
  useEffect(() => {
    base44.functions.invoke("shopProducts", {})
      .then((r) => setPdfs((r.data.products || []).filter((p) => p.is_free && p.status !== "wkrótce" && p.status !== "ukryty" && !EXCLUDED_SLUGS.includes(p.slug))))
      .catch(() => setPdfs([]));
  }, []);

  return (
    <div className="px-5 md:px-10 pt-28 md:pt-36 pb-20">
      <div className="mx-auto max-w-[1400px]">
        <header className="max-w-3xl pb-12 md:pb-16">
          <p className="technical text-[11px] gold-text mb-4">ZACZNIJ BEZPŁATNIE</p>
          <h1 className="relic-heading text-[clamp(2.25rem,9vw,4.25rem)] leading-[0.95] mb-6">
            Nie musisz od razu<br /><span className="gold-text">niczego kupować.</span>
          </h1>
          <p className="no-hyph text-lg leading-relaxed text-foreground/70">
            Wszystko na tej stronie jest bezpłatne. Wybierz to, na co masz dziś siłę: kilka minut, jeden list w tygodniu albo
            spotkanie z innymi. Możesz zacząć od czegokolwiek.
          </p>
        </header>

        <Group label="01 · KILKA MINUT" title="Na początek">
          <Item to="/test?src=zacznij" meta="OK. 3 MINUTY" title="Która śmierć jest Twoja?"
            text="Piętnaście pytań, na które odpowiadasz tylko sobie. Pomagają nazwać, przez co przechodzisz, i podpowiadają pierwszy krok." cta="ZRÓB TEST" />
          <Item to="/cisza?src=zacznij" meta="1–20 MINUT" title="Chwila ciszy"
            text="Minutnik ciszy w przeglądarce. Wybierasz czas, siadasz i po prostu jesteś. Bez rozpraszaczy." cta="WEJDŹ W CISZĘ" />
        </Group>

        <Group label="02 · DO CZYTANIA I SŁUCHANIA" title="Na kolejne dni">
          <Item to="/#listy-powrotu" meta="RAZ W TYGODNIU · E-MAIL" title="Listy powrotu"
            text="Jeden list w tygodniu: historia, myśl i pytanie na kolejne dni. Wypisujesz się jednym kliknięciem." cta="CHCĘ DOSTAWAĆ LISTY" />
          <Item to="/glos?src=zacznij" meta="PODCAST I MUZYKA" title="Głos"
            text="Rozmowy o kryzysach, które często pozostają niewidoczne, i muzyka EXMORTIS. Możesz słuchać od razu na stronie." cta="POSŁUCHAJ" />
          {pdfs.map((p) => (
            <Item key={p.id} to={`/skarbiec/${p.slug}?src=zacznij`} meta="BEZPŁATNY PDF · WYSYŁAM E-MAILEM" title={p.name}
              text={String(p.description || "").slice(0, 180).replace(/\s+\S*$/, "") + (String(p.description || "").length > 180 ? "…" : "")}
              cta="ZOBACZ BEZPŁATNY MATERIAŁ" />
          ))}
        </Group>

        <Group label="03 · Z INNYMI" title="Kiedy chcesz wyjść z tym do ludzi">
          <Item to="/spotkania?src=zacznij" meta="ONLINE · KAMERA NIEOBOWIĄZKOWA" title="Otwarte spotkania"
            text="Spotkania na żywo o powrocie po kryzysie. Możesz mówić albo po prostu słuchać." cta="ZOBACZ TERMINY" />
          <div className="flex flex-col justify-between border hairline bg-[#070708] p-6 md:p-8">
            <div>
              <p className="technical text-[10px] text-foreground/55 mb-3">WHATSAPP</p>
              <h3 className="relic-heading text-2xl leading-[1.05] mb-3">Głos między poniedziałkami</h3>
              <p className="text-foreground/70 leading-relaxed mb-6">Krótkie wiadomości na kanale WhatsApp. Tylko czytasz, nikt nie widzi Twojego numeru.</p>
            </div>
            <WhatsAppChannelLink miejsce="zacznij" label="DOŁĄCZ DO KANAŁU" />
          </div>
        </Group>

        <Group label="04 · Z DARMOWYM KONTEM" title="Kiedy chcesz wejść głębiej">
          <Item to={user ? ROZDROZA : `/register?returnTo=${encodeURIComponent(ROZDROZA)}`} meta="BEZPŁATNIE · PO ZAŁOŻENIU KONTA" title="Rozdroża"
            text="Interaktywne historie, w których to Ty podejmujesz decyzje i możesz zobaczyć, dokąd prowadzi inna droga. Nowa historia w każdy piątek."
            cta={user ? "OTWÓRZ ROZDROŻA" : "ZAŁÓŻ DARMOWE KONTO"} />
        </Group>

        <section className="pt-12 md:pt-16 border-t hairline max-w-3xl">
          <p className="no-hyph text-foreground/70 leading-relaxed">
            Jeśli chcesz porozmawiać ze mną osobiście, zobacz <Link to="/skarbiec/rozmowa-na-progu?src=zacznij" className="gold-text underline underline-offset-4">Rozmowę na progu</Link> albo
            program <Link to="/powrot?src=zacznij" className="gold-text underline underline-offset-4">POWRÓT</Link>. Te formy są płatne i zawsze opisuję je z ceną.
          </p>
        </section>
      </div>
    </div>
  );
}
