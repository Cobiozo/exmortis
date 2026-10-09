import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Section from "./Section";
import EventLine from "./EventLine";

export default function FinalWord() {
  return (
    <Section label="OSTATNIE SŁOWO">
      <div className="max-w-3xl space-y-8">
        <p className="relic-heading text-3xl md:text-5xl leading-tight text-foreground/85">
          Nie musisz decydować się dziś.
        </p>
        <p className="text-foreground/60 text-lg leading-relaxed">
          Ale jeśli po tej lekturze coś w Tobie mówi „to o mnie” — nie odkładaj
          tego na kwartał, w którym „będzie lepszy moment”. Powrót nie zaczyna się
          w lepszym momencie. Powrót zaczyna się od decyzji, żeby przestać czekać.
        </p>
        <EventLine />
        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <a href="#formularz" className="btn-relic">
            WYPEŁNIJ FORMULARZ KWALIFIKACYJNY <ArrowRight className="h-4 w-4" />
          </a>
          <Link to="/skarbiec" className="btn-ghost">
            ZOBACZ SKARBIEC — RÓŻNE DROGI POWROTU
          </Link>
        </div>
        <p className="text-foreground/50 leading-relaxed pt-2">
          Porozmawiamy bez zobowiązań. Zobaczymy, czy to Twój moment.
        </p>
      </div>
    </Section>
  );
}