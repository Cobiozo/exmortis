import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowDown } from "lucide-react";
import { base44 } from "@/api/base44Client";
import Logo from "@/components/exmortis/Logo";
import ProductCard from "@/components/exmortis/ProductCard";
import { Image } from "@/components/ui/image";

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
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Product.filter({ active: true }, "price", 6)
      .then((res) => setProducts(res))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-[#0A0A0B]">
      {/* ===== HERO — VANGUARD ===== */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden grain">
        <div className="absolute inset-0">
          <img
            src={HERO_IMG}
            alt=""
            className="w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0B] via-[#0A0A0B]/60 to-[#0A0A0B]" />
        </div>

        {/* Vertical spine */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 spine opacity-40" />

        <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-4xl">
          <div className="flicker">
            <Logo className="h-32 w-32 md:h-44 md:w-44 mb-8" />
          </div>
          <p className="technical text-[11px] md:text-xs gold-text mb-6 tracking-[0.4em]">
            GŁOS POWROTU
          </p>
          <h1 className="relic-heading text-5xl md:text-8xl lg:text-9xl leading-[0.9]">
            <span className="block">EXMORTIS</span>
          </h1>
          <p className="mt-8 text-lg md:text-xl text-foreground/70 max-w-2xl font-light leading-relaxed">
            Wracam z siebie. Uczę wracać.
            <br className="hidden md:block" />
            Droga powrotu ze śmierci mentalnej, duchowej i życiowej.
          </p>
          <div className="mt-12 flex flex-col sm:flex-row gap-4">
            <Link to="/sklep" className="btn-relic">
              WEJDŹ DO SKLEPU <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/o-mnie" className="btn-ghost">
              KIM JEST EXMORTIS
            </Link>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-foreground/40">
          <span className="technical text-[9px]">PRZEWIŃ</span>
          <ArrowDown className="h-4 w-4 animate-bounce" />
        </div>
      </section>

      {/* ===== MANIFEST ===== */}
      <section id="manifest" className="relative py-32 md:py-48 px-5 md:px-10 overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-px spine opacity-30" />
        <div className="mx-auto max-w-4xl">
          <p className="technical text-[11px] gold-text mb-16 text-center">MANIFEST · 01</p>
          <div className="space-y-8">
            {MANIFEST.map((line, i) => (
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
              <h2 className="relic-heading text-4xl md:text-6xl leading-[0.95]">
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
            {THREE_DEATHS.map((d, i) => (
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
            {THREE_TRUTHS.map((t, i) => (
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

      {/* ===== SKLEP PREVIEW ===== */}
      <section className="relative py-32 px-5 md:px-10 border-t hairline bg-[#070708]">
        <div className="mx-auto max-w-[1400px]">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
            <div>
              <p className="technical text-[11px] gold-text mb-4">SKARBIEC · 04</p>
              <h2 className="relic-heading text-4xl md:text-6xl leading-[0.95]">
                Droga<br />powrotu
              </h2>
            </div>
            <Link to="/sklep" className="btn-ghost self-start md:self-auto">
              CAŁY SKLEP <ArrowRight className="h-4 w-4" />
            </Link>
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

      {/* ===== CTA — POWRÓT ===== */}
      <section className="relative py-40 px-5 md:px-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#5C1A1B]/10 to-transparent" />
        <div className="relative mx-auto max-w-3xl text-center">
          <Logo className="h-20 w-20 mx-auto mb-10" />
          <h2 className="relic-heading text-4xl md:text-6xl leading-[0.95] mb-8">
            Zrób<br /><span className="gold-text">jeden ruch</span>
          </h2>
          <p className="text-foreground/60 text-lg leading-relaxed mb-12 max-w-xl mx-auto">
            Powrót nie zaczyna się od siły. Zaczyna się od jednego ruchu — małego, wykonalnego dziś.
          </p>
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