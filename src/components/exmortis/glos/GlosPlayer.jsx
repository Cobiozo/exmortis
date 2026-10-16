import React, { useEffect, useRef } from "react";
import { Play } from "lucide-react";
import { thumbUrl } from "./youtube";

// Ładuje YouTube IFrame API raz na stronę.
function loadYT(cb) {
  if (window.YT && window.YT.Player) {
    cb();
    return;
  }
  const prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    if (typeof prev === "function") prev();
    cb();
  };
  if (!document.getElementById("yt-iframe-api")) {
    const s = document.createElement("script");
    s.id = "yt-iframe-api";
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  }
}

// Główny odtwarzacz: dopóki `started` jest false, pokazuje miniaturę
// z przyciskiem play (bez ładowania iframe). Po starcie osadza przez
// youtube-nocookie.com i przy końcu utworu wywołuje onEnded.
export default function GlosPlayer({ videoId, started, onStart, onEnded }) {
  const holderRef = useRef(null);
  const playerRef = useRef(null);
  const loadedRef = useRef(null);
  const videoIdRef = useRef(videoId); // najnowsze ID — jeśli API YouTube doładuje się już po zmianie utworu
  videoIdRef.current = videoId;
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;

  useEffect(() => {
    if (!started) return;
    loadYT(() => {
      if (playerRef.current) return;
      playerRef.current = new window.YT.Player(holderRef.current, {
        videoId: videoIdRef.current,
        width: "100%",
        height: "100%",
        playerVars: { autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onStateChange: (e) => {
            if (e.data === window.YT.PlayerState.ENDED) endedRef.current();
          },
        },
      });
      loadedRef.current = videoId;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  useEffect(() => {
    if (!started || loadedRef.current === videoId) return;
    const p = playerRef.current;
    if (p && typeof p.loadVideoById === "function") {
      p.loadVideoById(videoId);
      loadedRef.current = videoId;
    }
  }, [started, videoId]);

  if (!started) {
    return (
      <button
        onClick={onStart}
        className="relative block w-full aspect-video border hairline overflow-hidden group bg-[#0A0A0B]"
        aria-label="Odtwórz utwór"
      >
        <img
          src={thumbUrl(videoId)}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-85 transition-opacity duration-500"
        />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="w-16 h-16 md:w-20 md:h-20 bg-[#BC1E22] flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
            <Play className="h-7 w-7 md:h-9 md:w-9 text-[#E2E2E2] ml-1" fill="currentColor" />
          </span>
        </span>
      </button>
    );
  }

  return (
    <div className="w-full aspect-video border hairline bg-black">
      <div ref={holderRef} className="w-full h-full" />
    </div>
  );
}