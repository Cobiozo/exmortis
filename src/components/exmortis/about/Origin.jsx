import React from "react";
import { useSiteContent } from "@/components/exmortis/SiteContentProvider";

export default function Origin() {
  const { rich } = useSiteContent();
  const content = rich(
    "about",
    "origin",
    `<p>I tak powstała przestrzeń exmortis — ze śmierci. Miejsce dla ludzi, którzy wychodzą: z tego, co ich zabijało po cichu. Z siebie sprzed lat. Ze śmierci mentalnej, duchowej albo życiowej. Do siebie. Do wzrostu.</p>
<p class="relic-heading gold-text text-2xl md:text-3xl mt-8">Nie ma sytuacji bez wyjścia.</p>
<p class="gold-text">Wiem to. Byłem tam, gdzie wydawało mi się, że jest.</p>`
  );

  return (
    <section className="relative py-32 md:py-40 px-5 md:px-10">
      <div className="absolute right-0 top-0 bottom-0 w-px spine opacity-30" />
      <div className="mx-auto max-w-4xl">
        <p className="technical text-[11px] gold-text mb-4">POWSTANIE · 03</p>
        <h2 className="relic-heading text-4xl md:text-6xl mb-16 leading-[0.95]">
          Skąd wzięło się<br />
          <span className="gold-text">„exmortis”?</span>
        </h2>
        <div
          className="rich-content text-lg leading-relaxed text-foreground/75"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    </section>
  );
}