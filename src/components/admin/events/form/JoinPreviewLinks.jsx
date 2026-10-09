import React from "react";
import { ExternalLink } from "lucide-react";

const STATES = [["przed", "Przed otwarciem"], ["otwarte", "Pokój otwarty"], ["po", "Po spotkaniu"]];

// Podgląd strony dołączenia w każdym stanie (parametr działa tylko dla administratora).
export default function JoinPreviewLinks({ slug }) {
  if (!slug) return <p className="text-xs text-foreground/45">Podgląd strony dołączenia będzie dostępny po zapisaniu spotkania.</p>;
  return (
    <div>
      <p className="technical text-[10px] text-foreground/50 mb-2">ZOBACZ STRONĘ DOŁĄCZENIA</p>
      <div className="flex flex-wrap gap-2">
        {STATES.map(([k, l]) => (
          <a key={k} href={`/spotkania/${slug}/dolacz?stan=${k}`} target="_blank" rel="noreferrer" className="btn-ghost !px-4 !py-2">
            {l} <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ))}
      </div>
    </div>
  );
}