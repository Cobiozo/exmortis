import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Logo from "@/components/exmortis/Logo";
import { Image } from "@/components/ui/image";
import { useSiteContent } from "@/components/exmortis/SiteContentProvider";
import ShortStory from "@/components/exmortis/about/ShortStory";
import Origin from "@/components/exmortis/about/Origin";
import WhoIAmNot from "@/components/exmortis/about/WhoIAmNot";
import WhatITeach from "@/components/exmortis/about/WhatITeach";

const PORTRAIT =
  "https://media.base44.com/images/public/6aa08bc6318b0f886cc3b9a3/74c8971f2_572398635_17869620246460401_6357932160691507676_n.jpg";

const TIMELINE = [
  { phase: "Śmierć", text: "Chodziłem, pracowałem, uśmiechałem się — a w środku była cisza, której nie umiałem nazwać. Żyłem na autopilocie." },
  { phase: "Próg", text: "Moment, w którym zrozumiałem: to, co uważałem za koniec, jest progiem. Trzeba było przez niego przejść." },
  { phase: "Powrót", text: "Powrót nie zaczyna się od siły. Zaczyna się od jednego ruchu. Małego. Wykonalnego. Powtórzonego jutro." },
  { phase: "Inny", text: "Wracam nie do tego, kim byłem. Wracam jako ktoś nowy. I uczę wracać innych." },
];

const PRINCIPLES = [
  { title: "Przewodnik, nie terapeuta", text: "Prowadzę przez powrót, nie leczę zaburzeń. Przy objawach klinicznych kieruję do specjalisty." },
  { title: "Pytania zamiast rad", text: "Nie mówię «zrób tak» — to Twoje życie, więc ostateczne decyzje podejmujesz Ty. Moim zadaniem jest poprzez zadawanie pytań pokazać różne perspektywy. Więcej słucham niż mówię." },
  { title: "Jeden ruch na sesję", text: "Każde spotkanie kończy się jednym konkretnym ruchem do wykonania. Bo powrót to ruchy, nie plany na rok." },
];

export default function About() {
  const { cards, rich } = useSiteContent();
  const heroTitle = rich("about", "heroTitle", 'Byłem tam.<br /><span class="gold-text">I wróciłem.</span><br />Inny.');
  const heroIntro = rich(
    "about",
    "heroIntro",
    "Ex ksiądz może jeszcze coś powiedzieć? Exmortis to przestrzeń dla osób, które chcą przebić przez swoje „dno”, zamienić swoje „grzebanie” w moment „sadzenia” i doświadczyć wzrostu."
  );
  const manifesto = rich(
    "about",
    "manifesto",
    "<p>Są dni, kiedy człowiek żyje, ale w środku już umarł. Chodzi, pracuje, uśmiecha się — a nie czuje nic.</p><p>Ja tam byłem. W miejscu, z którego wydawało się, że nie ma powrotu. Wróciłem. Nie do tego, kim byłem — jako ktoś nowy.</p>"
  );
  const timeline = cards("about", "timeline", TIMELINE);
  const principles = cards("about", "principles", PRINCIPLES);
  const ctaTitle = rich("about", "ctaTitle", 'Jeśli coś w Tobie<br /><span class="gold-text">już wie</span>');
  const ctaText = rich("about", "ctaText", "Że chodzisz i pracujesz, a w środku jest cisza — to znaczy, że już wracasz. Zrób pierwszy ruch.");
  return (
    <div className="bg-[#0A0A0B] pt-20">
      {/* Hero */}
      <section className="relative py-32 md:py-48 px-5 md:px-10 overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-px spine opacity-40" />
        <div className="mx-auto max-w-[1400px]">
          <p className="technical text-[11px] gold-text mb-6">KRONIKARZ · O MNIE</p>
          <div className="grid md:grid-cols-12 gap-10 items-end">
            <h1 className="md:col-span-8 relic-heading text-5xl md:text-8xl leading-[0.9]" dangerouslySetInnerHTML={{ __html: heroTitle }} />
            <div className="rich-content md:col-span-4 text-foreground/60 text-lg leading-relaxed" dangerouslySetInnerHTML={{ __html: heroIntro }} />
          </div>
        </div>
      </section>

      {/* Split portrait + manifesto */}
      <section className="grid md:grid-cols-2 border-y hairline min-h-[80vh]">
        <div className="relative bg-[#070708] overflow-hidden order-2 md:order-1">
          <Image
            src={PORTRAIT}
            alt="exmortis"
            fittingType="fill"
            className="absolute inset-0 w-full h-full"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0B] via-transparent to-transparent" />
          <div className="absolute bottom-8 left-8">
            <p className="technical text-[10px] gold-text">DAWID · EXMORTIS</p>
          </div>
        </div>
        <div className="p-10 md:p-16 lg:p-24 flex flex-col justify-center order-1 md:order-2">
          <p className="technical text-[11px] gold-text mb-8">MANIFEST OSOBISTY</p>
          <div className="rich-content space-y-6 text-lg leading-relaxed text-foreground/75" dangerouslySetInnerHTML={{ __html: manifesto }} />
        </div>
      </section>

      {/* Krótka historia */}
      <ShortStory />

      {/* Skąd wzięło się exmortis */}
      <Origin />

      {/* Kim NIE jestem */}
      <WhoIAmNot />

      {/* Czego uczę */}
      <WhatITeach />

      {/* Timeline — Śmierć / Próg / Powrót / Inny */}
      <section className="py-32 px-5 md:px-10 border-t hairline">
        <div className="mx-auto max-w-[1400px]">
          <p className="technical text-[11px] gold-text mb-4">DROGA · 06</p>
          <h2 className="relic-heading text-4xl md:text-6xl mb-20 leading-[0.95]">
            Śmierć → Próg →<br /><span className="gold-text">Powrót → Inny</span>
          </h2>

          <div className="relative">
            <div className="absolute left-0 top-0 bottom-0 w-px spine opacity-50 hidden md:block" />
            <div className="space-y-16">
              {timeline.map((t, i) => (
                <div key={i} className="md:pl-16 relative">
                  <div className="absolute left-0 top-2 w-3 h-3 border border-[#C9A24A] bg-[#0A0A0B] hidden md:block" />
                  <p className="font-mono text-sm gold-text mb-3">0{i + 1} · ETAP</p>
                  <h3 className="relic-heading text-3xl md:text-4xl mb-4">{t.phase}</h3>
                  <p className="text-foreground/65 text-lg leading-relaxed max-w-2xl">{t.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Principles */}
      <section className="py-32 px-5 md:px-10 border-y hairline bg-[#070708]">
        <div className="mx-auto max-w-[1400px]">
          <p className="technical text-[11px] gold-text mb-4">POSTAWA · 07</p>
          <h2 className="relic-heading text-4xl md:text-6xl mb-16 leading-[0.95]">
            Jak<br /><span className="gold-text">prowadzę</span>
          </h2>
          <div className="grid md:grid-cols-3 gap-px bg-[#3D3D3F]/40">
            {principles.map((p, i) => (
              <div key={i} className="bg-[#0A0A0B] p-10">
                <p className="font-mono text-4xl text-foreground/15 mb-6">0{i + 1}</p>
                <h3 className="relic-heading text-xl gold-text mb-4">{p.title}</h3>
                <p className="text-foreground/60 leading-relaxed">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-40 px-5 md:px-10 text-center">
        <Logo className="h-20 w-20 mx-auto mb-10" />
        <h2 className="relic-heading text-4xl md:text-6xl mb-8 leading-[0.95]" dangerouslySetInnerHTML={{ __html: ctaTitle }} />
        <div className="rich-content text-foreground/60 text-lg max-w-xl mx-auto mb-12 leading-relaxed" dangerouslySetInnerHTML={{ __html: ctaText }} />
        <Link to="/sklep" className="btn-relic">
          ZOBACZ DROGĘ POWROTU <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}