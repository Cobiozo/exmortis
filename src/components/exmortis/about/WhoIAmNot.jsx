import React from "react";
import { useSiteContent } from "@/components/exmortis/SiteContentProvider";

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
        <p className="technical text-[11px] gold-text mb-4">GRANICE · 04</p>
        <h2 className="relic-heading text-4xl md:text-6xl mb-16 leading-[0.95]">
          Kim <span className="blood-text">NIE</span>
          <br />
          jestem?
        </h2>
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