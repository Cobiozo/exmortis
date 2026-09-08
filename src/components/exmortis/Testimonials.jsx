import React from "react";
import { Quote } from "lucide-react";

// Podmień na prawdziwe opinie klientów — imię + produkt + zdanie
const TESTIMONIALS = [
  {
    text: "Myślałem, że wrócić znaczy wrócić do dawnego siebie. Dopiero na warsztacie zrozumiałem, że wracam jako ktoś inny — i że to jest lepsze.",
    name: "Marek",
    source: "Mini-Warsztat: Rytuał Pierwszego Ruchu",
  },
  {
    text: "To nie jest kolejna książka o motywacji. To konkret. Pierwszy ruch zrobiłem tego samego dnia, skończyłem czytać i po prostu poszedłem.",
    name: "Anna",
    source: "Ebook „Wracam Inny”",
  },
  {
    text: "Poszedłem na mentoring, bo nic już nie czułem. Po dwóch sesjach po raz pierwszy od roku coś mnie poruszyło. Nie jestem gotowy — ale ruszyłem.",
    name: "Tomek",
    source: "Mentoring 1:1 POWRÓT",
  },
];

export default function Testimonials() {
  return (
    <section className="py-32 px-5 md:px-10 border-t hairline">
      <div className="mx-auto max-w-[1400px]">
        <p className="technical text-[11px] gold-text mb-4">Świadectwa · 06</p>
        <h2 className="relic-heading text-4xl md:text-6xl mb-6 leading-[0.95]">
          Oni też<br /><span className="gold-text">wracali</span>
        </h2>
        <p className="text-foreground/60 text-lg max-w-xl mb-16 leading-relaxed">
          Nie planuj powrotu na podstawie obietnic. Słuchaj tych, którzy już przeszli.
        </p>

        <div className="grid md:grid-cols-3 gap-px bg-[#3D3D3F]/40">
          {TESTIMONIALS.map((t, i) => (
            <figure key={i} className="bg-[#0A0A0B] p-10 flex flex-col">
              <Quote className="h-8 w-8 gold-text mb-8" />
              <blockquote className="text-foreground/75 leading-relaxed flex-1">
                {t.text}
              </blockquote>
              <figcaption className="mt-8 pt-6 border-t hairline">
                <p className="relic-heading text-lg gold-text">{t.name}</p>
                <p className="technical text-[9px] text-foreground/40 mt-2">{t.source.toUpperCase()}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}