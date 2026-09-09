import React from "react";
import Section from "./Section";

const STAGES = [
  { num: "I", title: "Śmierć", desc: "Nazywamy, co w Tobie umarło. Bez dramatu i bez pocieszania. Prawda jest fundamentem powrotu." },
  { num: "II", title: "Próg", desc: "Podejmujesz decyzję. Nie deklarację — decyzję. To sesja, po której nie da się już żyć tak samo." },
  { num: "III", title: "Powrót", desc: "Odbudowujemy sens. Wnętrze. Codzienność. Tu dzieje się praca właściwa." },
  { num: "IV", title: "Inny", desc: "Kim jesteś teraz. Jak nie wrócić do śmierci. Jak iść dalej, żeby to, co powstało, zostało." },
];

export default function Stages() {
  return (
    <Section dark label="CZTERY ETAPY · 05" title={<>Cztery etapy <span className="gold-text">powrotu</span></>}>
      <p className="text-foreground/60 text-lg leading-relaxed max-w-2xl mb-12">
        Program stoi na czterech etapach. To nie jest teoria — to droga, którą sam przeszedłem.
      </p>
      <div className="grid md:grid-cols-2 gap-px bg-[#3D3D3F]/40">
        {STAGES.map((s) => (
          <div key={s.num} className="bg-[#0A0A0B] p-10 md:p-12 hover:bg-[#070708] transition-colors duration-500">
            <p className="relic-heading text-4xl gold-text mb-6">{s.num}</p>
            <h3 className="relic-heading text-2xl mb-4">{s.title}</h3>
            <p className="text-foreground/60 leading-relaxed">{s.desc}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}