import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowDown } from "lucide-react";
import { base44 } from "@/api/base44Client";
import Logo from "@/components/exmortis/Logo";
import ProductCard from "@/components/exmortis/ProductCard";
import ContactSection from "@/components/exmortis/ContactSection";
import NewsletterSection from "@/components/exmortis/NewsletterSection";
import ForWhom from "@/components/exmortis/ForWhom";
import PowrotTeaser from "@/components/exmortis/PowrotTeaser";
import EventsTeaser from "@/components/exmortis/events/EventsTeaser";
import ShortHistory from "@/components/exmortis/home/ShortHistory";
import ReturnPath from "@/components/exmortis/home/ReturnPath";
import { useSiteContent } from "@/components/exmortis/SiteContentProvider";

const HERO_IMG = "https://media.base44.com/images/public/6aa08bc6318b0f886cc3b9a3/b1f31269c_generated_f9afed1e.jpg";

const MANIFEST = [
  "Są dni, kiedy człowiek żyje, ale w środku już umarł.",
  "Chodzi, pracuje, uśmiecha się — a nie czuje nic.",
  "To nie słabość. To śmierć: mentalna, duchowa, życiowa.",
  "I nikt o niej głośno nie mówi.",
  "exmortis to nie motywacja. To droga powrotu.",
  "Nie musisz być gotowy. Musisz zrobić pierwszy ruch.",
];

const THREE_DEATHS = [
  {
    title: "Śmierć mentalna",
    desc: "Żyjesz na autopilocie i nic nie czujesz. Dni się powtarzają, a w środku jest cisza, której nie umiesz nazwać.",
  },
  {
    title: "Śmierć duchowa",
    desc: "Tracisz sens i nie wiesz, po co to wszystko. Wszystko działa, ale nic nie rezonuje.",
  },
  {
    title: "Śmierć życiowa",
    desc: "Rozstanie, żałoba, bankructwo albo choroba zabrały Ci grunt pod nogami.",
  },
];

export default function Home() {
  const { list, cards, rich } = useSiteContent();
  const manifest = list("home", "manifest", MANIFEST);
  const deaths = cards("home", "deaths", THREE_DEATHS);
  const skarbiecText = rich("home", "skarbiecText", "<p>Powrót ma cztery etapy: <strong>Śmierć · Próg · Powrót · Inny</strong>.</p><p>Na każdym z nich potrzeba innych narzędzi. Innych słów. Innej głębokości pracy.</p><p>W Skarbcu znajdziesz to, co pasuje do miejsca, w którym stoisz dzisiaj — od bezpłatnego listu tygodniowego po pracę jeden na jeden przez sześć miesięcy.</p>");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [heroCue, setHeroCue] = useState(true);

  useEffect(() => {
    const onScroll = () => setHeroCue(window.scrollY < 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    base44.functions
      .invoke("shopProducts", {})
      .then((res) => setProducts(res.data.products))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const scrollTo = (id) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="bg-[#0A0A0B]">
      {/* ===== 01 HERO ===== */}
      <section
        className="relative min-h-screen flex items-center justify-center overflow-hidden grain"
        style={{ minHeight: "100svh" }}
      >
        <div className="absolute inset-0">
          <img
            src={HERO_IMG}
            alt=""
            className="w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0B] via-[#0A0A0B]/60 to-[#0A0A0B]" />
        </div>

        <div className="relative z-10 flex flex-col items-center text-center px-6 pb-32 max-w-4xl">
          <div className="flicker">
            <Logo className="h-28 w-28 md:h-40 md:w-40 mb-8" />
          </div>
          <h1 className="font-heading text-5xl sm:text-6xl md:text-8xl lg:text-9xl leading-[0.95]">
            <span className="block tracking-[0.06em]">EXMORTIS</span>
            <span className="block gold-text mt-3">ze śmierci</span>
          </h1>
          <p className="mt-8 text-lg md:text-2xl text-foreground/75 font-light">
            Wracam z siebie. Uczę wracać.
          </p>
          <p className="mt-2 text-sm md:text-base text-foreground/50 font-light">
            Droga powrotu ze śmierci mentalnej, duchowej i życiowej.
          </p>
          <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/test?src=home-hero" className="btn-relic">
              Która śmierć jest Twoja? <ArrowRight className="h-4 w-4" />
            </Link>
            <button onClick={() => scrollTo("historia")} className="btn-ghost">
              KIM JEST EXMORTIS?
            </button>
          </div>
          <p className="technical text-[9px] text-foreground/40 mt-3">
            TEST · 3 MINUTY · BEZPŁATNIE
          </p>
        </div>

        <button
          onClick={() => scrollTo("manifest")}
          aria-label="Przewiń w dół"
          className={`absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-foreground/40 transition-opacity duration-500 ${
            heroCue ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <span className="technical text-[9px]">PRZEWIŃ</span>
          <ArrowDown className="h-4 w-4 animate-bounce" />
        </button>
      </section>

      {/* ===== MANIFEST · 01 ===== */}
      <section id="manifest" className="relative py-24 md:py-40 px-5 md:px-10 overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-px spine opacity-30" />
        <div className="mx-auto max-w-4xl">
          <p className="technical text-[11px] gold-text mb-14 text-center">MANIFEST · 01</p>
          <div className="space-y-6">
            {manifest.map((line, i) => (
              <p
                key={i}
                className={`font-heading text-xl md:text-3xl leading-snug ${
                  i === 4 ? "blood-text" : "text-foreground/85"
                }`}
              >
                {line}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TRZY ŚMIERCI · 02 ===== */}
      <section className="relative py-32 px-5 md:px-10 border-y hairline bg-[#070708]">
        <div className="mx-auto max-w-[1400px]">
          <div className="grid md:grid-cols-12 gap-10 mb-20">
            <div className="md:col-span-4">
              <p className="technical text-[11px] gold-text mb-4">TRZY ŚMIERCI · 02</p>
              <h2 className="relic-heading text-4xl md:text-5xl lg:text-6xl leading-[0.95]">
                Trzy<br />śmierci
              </h2>
            </div>
            <div className="md:col-span-8 flex items-end">
              <p className="text-foreground/60 text-lg leading-relaxed max-w-xl">
                Nie nazywają tego głośno. A ma imię. Zanim zaczniesz wracać, musisz wiedzieć,
                z czego wracasz.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-px bg-[#3D3D3F]/40">
            {deaths.map((d, i) => (
              <div key={i} className="bg-[#0A0A0B] p-10 md:p-12 group hover:bg-[#070708] transition-colors duration-500">
                <p className="font-mono text-5xl text-foreground/15 mb-8">0{i + 1}</p>
                <h3 className="relic-heading text-2xl gold-text mb-5">{d.title}</h3>
                <p className="text-foreground/60 leading-relaxed">{d.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== DLA KOGO · 03 ===== */}
      <ForWhom />

      {/* ===== KRÓTKA HISTORIA · 04 ===== */}
      <ShortHistory />

      {/* ===== DROGA POWROTU · 05 ===== */}
      <ReturnPath />

      {/* ===== POWRÓT · 06 ===== */}
      <PowrotTeaser />

      {/* ===== SPOTKANIA · 07 ===== */}
      <EventsTeaser />

      {/* ===== SKARBIEC · 08 ===== */}
      <section className="relative py-32 px-5 md:px-10 border-t hairline bg-[#070708]">
        <div className="mx-auto max-w-[1400px]">
          <div className="grid md:grid-cols-12 gap-10 mb-16">
            <div className="md:col-span-4">
              <p className="technical text-[11px] gold-text mb-4">SKARBIEC · 08</p>
              <h2 className="relic-heading text-4xl md:text-5xl lg:text-6xl leading-[0.95]">
                Skarbiec
              </h2>
            </div>
            <div className="md:col-span-8">
              <div className="rich-content text-foreground/60 text-lg leading-relaxed max-w-xl" dangerouslySetInnerHTML={{ __html: skarbiecText }} />
              <Link to="/sklep" className="btn-ghost mt-8">
                CAŁY SKARBIEC <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="aspect-square bg-card border hairline animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.slice(0, 3).map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ===== LISTY POWROTU · 09 ===== */}
      <NewsletterSection />

      {/* ===== KONTAKT · 10 ===== */}
      <ContactSection />
    </div>
  );
}