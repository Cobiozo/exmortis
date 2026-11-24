import React from "react";
import { Music, Pause, Play, Volume2 } from "lucide-react";
import { Image } from "@/components/ui/image";
import { thumbUrl } from "./youtube";
import { hasAudio, ytId } from "./musicUtils";

// Jeden utwór na liście: miniatura, tytuł, autor; bieżący wyróżniony, dyskretne „Teraz gra”.
export default function MusicRow({ x, i, on, live, consent, onPick }) {
  const id = ytId(x);
  return (
    <li className="border-t border-exm-line first:border-t-0">
      <button
        type="button" onClick={onPick} aria-current={on ? "true" : undefined}
        aria-label={`${live ? "Wstrzymaj" : "Odtwórz"}: ${x.tytul}`}
        className={`flex w-full items-center gap-3 px-5 py-3 text-left transition-colors ${on ? "bg-[#C9A24A]/10" : "hover:bg-white/[0.03]"}`}
      >
        <span className={`w-6 shrink-0 text-center technical text-[11px] ${on ? "text-exm-gold" : "text-exm-muted"}`}>
          {live ? <Volume2 className="mx-auto h-4 w-4" aria-hidden="true" /> : String(i + 1).padStart(2, "0")}
        </span>
        <span className="hidden h-12 w-12 shrink-0 overflow-hidden rounded-md border border-exm-line bg-exm-surface-2 sm:flex sm:items-center sm:justify-center">
          {x.okladka ? <Image src={x.okladka} alt="" className="h-full w-full" />
            : consent && id ? <img src={thumbUrl(id)} alt="" loading="lazy" className="h-full w-full object-cover" />
            : <Music className="h-4 w-4 text-exm-muted" aria-hidden="true" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate font-exm-serif text-[17px] leading-snug ${on ? "text-exm-gold" : "text-exm-ivory"}`}>{x.tytul}</span>
          <span className="block truncate text-[12px] text-exm-muted">
            {live && <span className="text-exm-gold">Teraz gra · </span>}
            {x.autor || "EXMORTIS"}{!hasAudio(x) && " · wideo"}
          </span>
        </span>
        {live ? <Pause className="h-4 w-4 shrink-0 text-exm-gold" aria-hidden="true" /> : <Play className={`h-4 w-4 shrink-0 ${on ? "text-exm-gold" : "text-exm-muted"}`} aria-hidden="true" />}
      </button>
    </li>
  );
}