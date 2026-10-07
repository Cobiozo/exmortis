import React from "react";
import { Podcast, Youtube, Apple, Rss } from "lucide-react";

const CH = [["spotify", "Spotify", Podcast], ["youtube", "YouTube", Youtube], ["apple", "Apple Podcasts", Apple], ["rss", "RSS", Rss]];

export default function SubscribeLinks({ settings, small }) {
  const list = CH.filter(([k]) => settings?.[k]);
  if (!list.length) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {list.map(([k, label, Icon]) => (
        <a key={k} href={settings[k]} target="_blank" rel="noreferrer" className={`btn-ghost ${small ? "!px-4 !py-2 text-[10px]" : ""}`}>
          <Icon className="h-4 w-4" /> {label.toUpperCase()}
        </a>
      ))}
    </div>
  );
}