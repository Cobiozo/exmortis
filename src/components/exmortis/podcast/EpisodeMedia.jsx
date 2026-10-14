import React, { useState } from "react";
import { extractVideoId } from "@/components/exmortis/glos/youtube";
import EpisodePlayer from "./EpisodePlayer";

const spotifyEmbed = (u) => u?.replace("open.spotify.com/", "open.spotify.com/embed/").split("?")[0];

// Własny plik → wspólny odtwarzacz; inaczej osadzenie Spotify / YouTube.
export default function EpisodeMedia({ ep, startAt }) {
  const yt = extractVideoId(ep.youtube);
  const [mode, setMode] = useState(ep.audio || ep.spotify ? "audio" : "video");
  const tab = (m) => `technical text-[10px] px-4 py-2 border ${mode === m ? "border-[#C9A24A] gold-text" : "hairline text-foreground/55"}`;
  return (
    <div className="space-y-3">
      {yt && (ep.audio || ep.spotify) && (
        <div className="flex gap-2"><button onClick={() => setMode("audio")} className={tab("audio")}>AUDIO</button><button onClick={() => setMode("video")} className={tab("video")}>WIDEO</button></div>
      )}
      {mode === "audio" && ep.audio && <EpisodePlayer ep={ep} startAt={startAt} />}
      {mode === "audio" && !ep.audio && ep.spotify && (
        <iframe src={spotifyEmbed(ep.spotify)} title={ep.tytul} height="232" loading="lazy" allow="autoplay; clipboard-write; encrypted-media" className="w-full border hairline" />
      )}
      {mode === "video" && yt && (
        <iframe src={`https://www.youtube-nocookie.com/embed/${yt}${startAt ? `?start=${startAt}` : ""}`} title={ep.tytul} allowFullScreen loading="lazy" className="w-full aspect-video border hairline" />
      )}
    </div>
  );
}