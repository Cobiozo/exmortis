import React, { useState } from "react";
import { ArrowRight, Play } from "lucide-react";
import useMarketingConsent from "@/lib/useMarketingConsent";

// Wideo YouTube (tryb nocookie): miniatura ze złotym przyciskiem play,
// iframe z autoplay ładuje się dopiero po kliknięciu. Proporcje 16:9,
// pełna szerokość, cienka złota ramka, pod spodem link do YouTube.
export default function YouTubeEmbed({ videoId, watchUrl, title }) {
  const [play, setPlay] = useState(false);
  // Miniatura z YouTube tylko po zgodzie na treści zewnętrzne.
  const consent = useMarketingConsent();

  return (
    <div className="w-full">
      {play ? (
        <div className="relative w-full aspect-video border border-[#C9A24A]/60">
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <button
          onClick={() => setPlay(true)}
          aria-label={title}
          className="relative block w-full aspect-video border border-[#C9A24A]/60 bg-[#070708] overflow-hidden group"
        >
          {consent && (
            <img
              src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500"
            />
          )}
          {!consent && <span className="absolute bottom-2 left-0 right-0 px-3 text-[11px] text-foreground/70 text-center">Odtwarzacz YouTube — po kliknięciu YouTube otrzyma Twój adres IP</span>}
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-16 h-16 md:w-20 md:h-20 rounded-full border-2 border-[#C9A24A] bg-[#0A0A0B]/70 flex items-center justify-center group-hover:bg-[#C9A24A]/20 transition-colors">
              <Play className="h-7 w-7 gold-text translate-x-0.5" fill="currentColor" />
            </span>
          </span>
        </button>
      )}

      <a
        href={watchUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-foreground/55 hover:gold-text transition-colors mt-4"
      >
        Otwórz na YouTube <ArrowRight className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}