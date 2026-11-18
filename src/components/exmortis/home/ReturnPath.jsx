import React from "react";
import SafeImg from "@/components/cms/SafeImg";
import Section from "@/components/exmortis/ui/Section";
import Container from "@/components/exmortis/ui/Container";
import SectionHeader from "@/components/exmortis/ui/SectionHeader";

// „Droga — cztery etapy” (etap 2, 18.11.2026): pozioma mapa na komputerze, pionowa oś na telefonie.
// Opcjonalne tło sekcji (pole „tlo”, mocno przyciemnione). Etapy opisują sposób myślenia, nie przebieg.
const STAGES = [
  { name: "Śmierć", text: "Nazywasz to, co w Tobie umarło. Bez upiększania i bez oceniania." },
  { name: "Próg", text: "Zatrzymujesz się i decydujesz, że wracasz. To pierwszy ruch, nie gotowość." },
  { name: "Powrót", text: "Krok po kroku budujesz siebie na nowo: rytm, relacje, sens." },
  { name: "Inny", text: "Nie wracasz do dawnej wersji siebie. Wracasz jako ktoś nowy." },
];

export default function ReturnPath({ d = {}, label }) {
  return (
    <Section tone="surface" className="relative overflow-hidden">
      {d.tlo?.url && (
        <div className="absolute inset-0" aria-hidden="true">
          <SafeImg img={{ ...d.tlo, alt: "" }} className="h-full w-full" />
          <div className="absolute inset-0 bg-exm-bg opacity-85" />
        </div>
      )}

      <Container className="relative">
        <SectionHeader
          eyebrow={d.etykieta || label || "DROGA POWROTU"}
          title={d.tytul || "Droga powrotu ma cztery etapy"}
          lead="Powrót nie dzieje się w jeden dzień. Na każdym etapie potrzeba czegoś innego — dlatego tak samo zbudowany jest mentoring POWRÓT."
        />

        <ol className="relative mt-10 grid gap-8 md:mt-14 md:grid-cols-4 md:gap-6">
          <span aria-hidden="true" className="absolute left-[13px] top-3 bottom-3 w-px bg-exm-line-strong md:hidden" />
          <span aria-hidden="true" className="absolute left-[13px] right-[13px] top-[13px] hidden h-px bg-exm-line-strong md:block" />
          {STAGES.map((s, i) => (
            <li key={s.name} className="relative pl-10 md:pl-0">
              <span
                aria-hidden="true"
                className="absolute left-0 top-0 grid h-[27px] w-[27px] place-items-center rounded-full border border-exm-gold-line bg-exm-bg text-[10px] font-medium text-exm-gold md:static md:mb-6"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="exm-h3">{s.name}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-exm-muted">{s.text}</p>
            </li>
          ))}
        </ol>

        <p className="mt-10 max-w-[60ch] text-[14px] leading-relaxed text-exm-muted">
          Ta mapa opisuje sposób myślenia o powrocie. Nie gwarantuje przebiegu ani czasu — każdy wraca swoim tempem.
        </p>
      </Container>
    </Section>
  );
}