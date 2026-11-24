import React from "react";
import { Music } from "lucide-react";
import { SOURCE_LABEL, sourceOf, ytId } from "@/components/exmortis/glos/musicUtils";
import SourceBadge from "./SourceBadge";

// Podgląd przed publikacją: tak utwór wygląda na liście, z odsłuchem pliku i podglądem tekstu.
export default function SongPreview({ song }) {
  const src = sourceOf(song);
  return (
    <div className="border hairline p-4 space-y-3">
      <p className="technical text-[10px] text-foreground/50">Podgląd</p>
      <div className="flex items-center gap-3">
        {song.okladka ? <img src={song.okladka} alt="" className="h-14 w-14 object-cover rounded" /> : <span className="grid h-14 w-14 place-items-center rounded bg-[#161618]"><Music className="h-5 w-5 gold-text" /></span>}
        <div className="min-w-0">
          <p className="shop-heading text-lg truncate">{song.tytul || "Bez tytułu"}</p>
          <p className="text-xs text-foreground/55">{[song.autor || "EXMORTIS", song.kategoria].filter(Boolean).join(" · ")}</p>
        </div>
        <SourceBadge src={src} />
      </div>
      {src === "audio" && <audio src={song.audio_url} controls preload="none" className="w-full" aria-label={`Odsłuch: ${song.tytul}`} />}
      {src === "youtube" && <a href={`https://www.youtube.com/watch?v=${ytId(song)}`} target="_blank" rel="noreferrer" className="text-xs gold-text underline">Otwórz na YouTube</a>}
      {src === "brak" && <p className="text-xs text-[#E8C547]">{SOURCE_LABEL.brak}: dodaj plik, adres audio albo link YouTube.</p>}
      {song.tekst?.trim() && <details><summary className="cursor-pointer text-xs">Tekst utworu</summary><p className="mt-2 whitespace-pre-line text-xs text-foreground/70">{song.tekst}</p></details>}
    </div>
  );
}