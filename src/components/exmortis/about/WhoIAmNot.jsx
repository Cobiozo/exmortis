import React from "react";
import { Image } from "@/components/ui/image";
import { useSiteContent } from "@/components/exmortis/SiteContentProvider";

const PORTRAIT =
  "https://media.base44.com/images/public/6aa08bc6318b0f886cc3b9a3/76a96cdf4_686174507_17893800810460401_1310148896120990981_n.jpg";

const DEFAULT_NOTS = [
  {
    title: "Nie jestem coachem",
    text: "Nie sprzedaję sukcesu ani Lamborghini w miesiąc. Nie robię „10 sposobów na cokolwiek”.",
  },
  {
    title: "Nie jestem terapeutą",
    text: "Jeśli jesteś w klinicznym kryzysie — najpierw specjalista, potem ja. Powiem Ci to na rozmowie kwalifikacyjnej i jeśli trzeba, wskażę kierunek.",
  },
  {
    title: "Nie jestem już księdzem",
    text: "Ale to, co zrozumiałem dzięki studiom, posłudze kapłańskiej — o człowieku, o głębi, o ciszy, o towarzyszeniu drugiemu przez próg — zostało. I stało się fundamentem tego, co robię teraz.",
  },
];

export default function WhoIAmNot() {
  const { cards, rich } = useSiteContent();
  const nots = cards("about", "whoIAmNot", DEFAULT_NOTS);
  const mentor = rich(
    "about",
    "whoIAm",
    `<p>Jestem <strong class="gold-text">mentorem</strong>. Czyli człowiekiem, który idzie kawałek obok Ciebie, bo szedł tą drogą wcześniej. Nie mam mapy Twojego życia. Zostawiam kompas, nie kierunek.</p>`
  );

  return (
    <section className="py-32 px-5 md:px-10 border-y hairline bg-[#070708]">
      <div className="mx-auto max-w-[1400px]">
        <div className="grid md:grid-cols-12 gap-10 items-end mb-16">
          <div className="md:col-span-7">
            <p className="technical text-[11px] gold-text mb-4">GRANICE · 04</p>
            <h2 className="relic-heading text-4xl md:text-6xl leading-[0.95]">
              Kim <span className="blood-text">NIE</span>
              <br />
              jestem?
            </h2>
          </div>
          <div className="md:col-span-5 relative overflow-hidden grayscale contrast-125 order-first md:order-last">
            <Image
              src={PORTRAIT}
              alt="Dawid — exmortis"
              fittingType="fill"
              className="w-full aspect-[4/3]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#070708] via-transparent to-transparent" />
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-px bg-[#3D3D3F]/40">
          {nots.map((n, i) => (
            <div key={i} className="bg-[#0A0A0B] p-10">
              <p className="font-mono text-4xl text-foreground/15 mb-6">0{i + 1}</p>
              <h3 className="relic-heading text-xl gold-text mb-4">{n.title}</h3>
              <p className="text-foreground/60 leading-relaxed">{n.text}</p>
            </div>
          ))}
        </div>
        <div className="bg-[#0A0A0B] border-t hairline p-10 md:p-16 text-center">
          <div
            className="rich-content text-lg leading-relaxed text-foreground/75 max-w-2xl mx-auto"
            dangerouslySetInnerHTML={{ __html: mentor }}
          />
        </div>
      </div>
    </section>
  );
}