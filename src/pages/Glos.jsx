import React from "react";
import MusicSection from "@/components/exmortis/MusicSection";
import PodcastSection from "@/components/exmortis/PodcastSection";
import PodcastGuest from "@/components/exmortis/PodcastGuest";
import { useSiteContent } from "@/components/exmortis/SiteContentProvider";

export default function Glos() {
  const { rich } = useSiteContent();
  const heroIntro = rich("glos", "heroIntro", "Muzyka powrotu i podcasty o drodze tam i z powrotem. Słuchaj tam, gdzie jesteś.");
  return (
    <div className="bg-[#0A0A0B] pt-20">
      <section className="py-24 md:py-32 px-5 md:px-10">
        <div className="mx-auto max-w-[1400px] text-center">
          <p className="technical text-[11px] gold-text mb-4">GŁOS · 01</p>
          <h1 className="relic-heading text-5xl md:text-8xl leading-[0.9] mb-8">
            Głos <span className="gold-text">exmortis</span>
          </h1>
          <div className="rich-content text-foreground/60 text-lg max-w-xl mx-auto leading-relaxed" dangerouslySetInnerHTML={{ __html: heroIntro }} />
        </div>
      </section>
      <MusicSection />
      <PodcastSection />
      <PodcastGuest />
    </div>
  );
}