import React, { useState } from "react";
import { Play } from "lucide-react";

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A24A]";

const PROVIDER = (embed) => {
  const u = String(embed || "");
  if (u.includes("youtube")) return "YouTube";
  if (u.includes("vimeo")) return "Vimeo";
  if (u.includes("mediadelivery")) return "Bunny";
  return "serwis zewnętrzny";
};

// Zaślepka: własna grafika (bez miniaturek z serwisu). Iframe wchodzi dopiero po kliknięciu,
// wtedy też mówimy wprost, że serwis może zapisać pliki cookies.
export default function VideoFacade({ embed, title }) {
  const [on, setOn] = useState(false);

  if (!embed) {
    return <p className="text-foreground/55 text-[15px]">Ten film nie ma jeszcze poprawnego adresu.</p>;
  }

  if (on) {
    return (
      <div className="relative w-full aspect-video bg-black border hairline">
        <iframe
          src={embed}
          title={title || "Film"}
          className="absolute inset-0 w-full h-full"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          allow="fullscreen; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOn(true)}
      className={`group relative w-full aspect-video bg-[#0F0F10] border hairline overflow-hidden ${FOCUS}`}
    >
      <span className="absolute inset-0 opacity-[0.14]" aria-hidden="true"
        style={{ backgroundImage: "repeating-linear-gradient(135deg,#C9A24A 0 2px,transparent 2px 14px)" }} />
      <span className="relative flex flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="flex items-center justify-center w-16 h-16 border border-[#C9A24A] text-[#C9A24A] group-hover:bg-[#C9A24A] group-hover:text-[#0A0A0B] transition-colors">
          <Play className="w-6 h-6" strokeWidth={1.5} />
        </span>
        <span className="font-mono text-[11px] tracking-[0.14em] uppercase text-[#C9A24A]">Odtwórz film</span>
        <span className="font-body text-[13px] leading-relaxed text-foreground/60 max-w-[42ch]">
          Kliknij, aby odtworzyć film z {PROVIDER(embed)} — po kliknięciu serwis może zapisać pliki cookies.
        </span>
      </span>
    </button>
  );
}