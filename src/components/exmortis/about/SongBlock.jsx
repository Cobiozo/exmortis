import React from "react";
import YouTubeEmbed from "./YouTubeEmbed";

// Podstrona O mnie: piosenka „exmortis” — blok zaraz pod Krótką historią.
export default function SongBlock() {
  return (
    <section className="py-24 md:py-32 px-5 md:px-10">
      <div className="mx-auto max-w-[1400px]">
        <p className="technical text-[11px] gold-text mb-4">POSŁUCHAJ · EXMORTIS</p>
        <h2 className="relic-heading text-4xl md:text-6xl mb-12 leading-[0.95]">
          Całą tę historię opowiedziałem w piosence.
        </h2>
        <YouTubeEmbed
          videoId="SRBc9PiYhfo"
          watchUrl="https://youtu.be/SRBc9PiYhfo"
          title="exmortis — piosenka"
        />
      </div>
    </section>
  );
}