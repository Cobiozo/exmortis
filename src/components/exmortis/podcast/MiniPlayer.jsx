import React from "react";
import { Link } from "react-router-dom";
import { Pause, Play, X } from "lucide-react";
import { Image } from "@/components/ui/image";
import { usePodcastPlayer } from "./PlayerContext";

export default function MiniPlayer() {
  const p = usePodcastPlayer();
  const pct = p.dur ? (p.t / p.dur) * 100 : 0;
  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-[#0A0A0B] border-t border-[#C9A24A]/30 pb-[env(safe-area-inset-bottom)]">
      <div className="h-0.5 bg-[#3D3D3F]"><div className="h-full bg-[#C9A24A]" style={{ width: `${pct}%` }} /></div>
      <div className="flex items-center gap-4 px-4 py-2 max-w-[1400px] mx-auto">
        {p.ep.okladka && <Image src={p.ep.okladka} alt="" className="h-10 w-10 shrink-0" />}
        <Link to={p.ep.href || `/glos/${p.ep.slug}`} className="flex-1 min-w-0 text-sm text-[#F5EFE1] truncate hover:text-[#C9A24A]">{p.ep.href ? "" : `#${p.ep.numer} · `}{p.ep.tytul}</Link>
        <button onClick={p.toggle} aria-label={p.playing ? "Pauza" : "Odtwórz"} className="p-2 gold-text">
          {p.playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
        <button onClick={p.close} aria-label="Zamknij" className="p-2 text-foreground/50 hover:text-foreground"><X className="h-5 w-5" /></button>
      </div>
    </div>
  );
}