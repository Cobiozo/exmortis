import React from "react";
import PowrotHero from "@/components/exmortis/powrot/PowrotHero";
import Opening from "@/components/exmortis/powrot/Opening";
import ForWhomPowrot from "@/components/exmortis/powrot/ForWhomPowrot";
import NotForYou from "@/components/exmortis/powrot/NotForYou";
import PromiseSection from "@/components/exmortis/powrot/Promise";
import Stages from "@/components/exmortis/powrot/Stages";
import HowItWorks from "@/components/exmortis/powrot/HowItWorks";
import Deliverables from "@/components/exmortis/powrot/Deliverables";
import Qualification from "@/components/exmortis/powrot/Qualification";
import Faq from "@/components/exmortis/powrot/Faq";
import FinalWord from "@/components/exmortis/powrot/FinalWord";
import PowrotForm from "@/components/exmortis/powrot/PowrotForm";

export default function Powrot() {
  return (
    <div className="bg-[#0A0A0B]">
      <PowrotHero />
      <Opening />
      <ForWhomPowrot />
      <NotForYou />
      <PromiseSection />
      <Stages />
      <HowItWorks />
      <Deliverables />
      <Qualification />
      <Faq />
      <FinalWord />
      <PowrotForm />

      <section className="py-24 border-t hairline text-center px-5">
        <p className="technical text-[11px] gold-text mb-4">EXMORTIS — ZE ŚMIERCI</p>
        <p className="relic-heading text-2xl md:text-4xl text-foreground/80">
          „Wracam z siebie. Uczę wracać.”
        </p>
      </section>
    </div>
  );
}