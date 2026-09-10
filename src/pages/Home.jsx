import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowDown } from "lucide-react";
import { base44 } from "@/api/base44Client";
import Logo from "@/components/exmortis/Logo";
import ProductCard from "@/components/exmortis/ProductCard";
import Testimonials from "@/components/exmortis/Testimonials";
import ContactSection from "@/components/exmortis/ContactSection";
import ForWhom from "@/components/exmortis/ForWhom";
import PowrotTeaser from "@/components/exmortis/PowrotTeaser";
import { Image } from "@/components/ui/image";
import { useSiteContent } from "@/components/exmortis/SiteContentProvider";

const HERO_IMG = "https://media.base44.com/images/public/6aa08bc6318b0f886cc3b9a3/b1f31269c_generated_f9afed1e.jpg";

const MANIFEST = [
  "Są dni, kiedy człowiek żyje, ale w środku już umarł.",
  "Chodzi, pracuje, uśmiecha się — a nie czuje nic.",
  "To nie słabość. To śmierć mentalna. Duchowa. Życiowa.",
  "I nikt o niej głośno nie mówi.",
  "Ja tam byłem. I wróciłem. Inny.",
  "exmortis to nie motywacja. To droga powrotu.",
  "Nie musisz być gotowy. Musisz zrobić pierwszy ruch.",
  "Reszty nauczę Cię po drodze.",
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

const THREE_TRUTHS = [
  "Nie musisz być silny, żeby wrócić. Musisz zrobić pierwszy ruch.",
  "Śmierć mentalna, duchowa i życiowa nie są końcem — są progiem.",
  "Wracasz nie do tego, kim byłeś. Wracasz jako ktoś nowy.",
];

export default function Home() {
  const { list, cards, rich } = useSiteContent();
  const heroSubtitle = rich("home", "heroSubtitle", "Wracam z siebie. Uczę wracać.<br />Droga powrotu ze śmierci mentalną, duchową i życiową.");
  const manifest = list("home", "manifest", MANIFEST);
  const deaths = cards("home", "deaths", THREE_DEATHS);
  const truths = list("home", "truths", THREE_TRUTHS);
  const ctaTitle = rich("home", "ctaTitle", 'Zrób<br /><span class="gold-text">jeden ruch</span>');
  const ctaText = rich("home", "ctaText", "Powrót nie zaczyna się od siły. Zaczyna się od jednego ruchu — małego, wykonalnego dziś.");
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

  return (
    <div className="bg-[#0A0A0B]">
      {/* ===== HERO — VANGUARD ===== */}
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
            <Logo className="h-32 w-32 md:h-44 md:w-44 mb-8" />
          </div>
          <h1 className="relic-heading text-4xl sm:text-5xl md:text-8xl lg:text-9xl leading-[0.9]">
            <span className="block">EXMORTIS</span>
          </h1>
          <div className="rich-content mt-8 text-lg md:text-xl text-foreground/70 max-w-2xl font-light leading-relaxed" dangerouslySetInnerHTML={{ __html: heroSubtitle }} />
          <div className="mt-12 flex flex-col sm:flex-row gap-4">
            <Link to="/sklep" className="btn-relic">
              POZNAJ SKARBIEC <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/o-mnie" className="btn-ghost">
              KIM JEST EXMORTIS
            </Link>
          </div>
        </div>

        <button
          onClick={() =>
            document.getElementById("manifest")?.scrollIntoView({ behavior: "smooth" })
          }
          aria-label="Przewiń w dół"
          className={`absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-foreground/40 transition-opacity duration-500 ${
            heroCue ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <span className="technical text-[9px]">PRZEWIŃ</span>
          <ArrowDown className="h-4 w-4 animate-bounce" />
        </button>
      </section>

      {/* ===== MANIFEST ===== */}
      <section id="manifest" className="relative py-32 md:py-48 px-5 md:px-10 overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-px spine opacity-30" />
        <div className="mx-auto max-w-4xl">
          <p className="technical text-[11px] gold-text mb-16 text-center">MANIFEST · 01</p>
          <div className="space-y-8">
            {manifest.map((line, i) => (
              <p
                key={i}
                className={`relic-heading leading-tight transition-all duration-700 ${
                  i === 5 ? "text-2xl md:text-4xl blood-text" : "text-2xl md:text-4xl text-foreground/85"
                }`}
              >
                {line}
              </p>
            ))}
          </div>
          <p className="relic-heading text-2xl md:text-3xl gold-text mt-12">
            Wracam z siebie. Uczę wracać.
          </p>
        </div>
      </section>

      {/* ===== THREE DEATHS ===== */}
      <section className="relative py-32 px-5 md:px-10 border-y hairline bg-[#070708]">
        <div className="mx-auto max-w-[1400px]">
          <div className="grid md:grid-cols-12 gap-10 mb-20">
            <div className="md:col-span-4">
              <p className="technical text-[11px] gold-text mb-4">DIAGNOZA · 02</p>
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

      {/* ===== THREE TRUTHS ===== */}
      <section className="relative py-32 md:py-48 px-5 md:px-10">
        <div className="absolute right-0 top-0 bottom-0 w-px spine opacity-30" />
        <div className="mx-auto max-w-5xl">
          <p className="technical text-[11px] gold-text mb-16 text-center">TRZY ZDANIA · 03</p>
          <div className="space-y-16">
            {truths.map((t, i) => (
              <div key={i} className="flex gap-6 md:gap-10 items-start">
                <span className="font-mono text-xl gold-text mt-2 flex-shrink-0">0{i + 1}</span>
                <p className="relic-heading text-2xl md:text-4xl leading-tight text-foreground/85">
                  {t}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== DLA KOGO ===== */}
      <ForWhom />

      {/* ===== POWRÓT — TEASER ===== */}
      <PowrotTeaser />

      {/* ===== SKLEP PREVIEW ===== */}
      <section className="relative py-32 px-5 md:px-10 border-t hairline bg-[#070708]">
        <div className="mx-auto max-w-[1400px]">
          <div className="grid md:grid-cols-12 gap-10 mb-16">
            <div className="md:col-span-4">
              <p className="technical text-[11px] gold-text mb-4">SKARBIEC · 06</p>
              <h2 className="relic-heading text-4xl md:text-5xl lg:text-6xl leading-[0.95]">
                Droga<br />powrotu
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

      {/* ===== ŚWIADECTWA ===== */}
      <Testimonials />

      {/* ===== KONTAKT ===== */}
      <ContactSection />

      {/* ===== CTA — POWRÓT ===== */}
      <section className="relative py-40 px-5 md:px-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#5C1A1B]/10 to-transparent" />
        <div className="relative mx-auto max-w-3xl text-center">
          <Logo className="h-20 w-20 mx-auto mb-10" />
          <h2 className="relic-heading text-4xl md:text-6xl leading-[0.95] mb-8" dangerouslySetInnerHTML={{ __html: ctaTitle }} />
          <div className="rich-content text-foreground/60 text-lg leading-relaxed mb-12 max-w-xl mx-auto" dangerouslySetInnerHTML={{ __html: ctaText }} />
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/sklep" className="btn-relic">
              ZACZNIJ POWRÓT <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#kontakt" className="btn-ghost">
              ZAPISZ SIĘ NA NEWSLETTER
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}