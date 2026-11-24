import React from "react";
import { usePodcastPlayer } from "./PlayerContext";

// Kolejka w rozwiniętej belce: kliknięcie uruchamia nagranie, bieżące jest wyróżnione.
export default function PlayerQueue() {
  const p = usePodcastPlayer();
  const list = (p.queue || []).filter((x) => x.audio);
  if (list.length < 2) return null;
  return (
    <div>
      <p className="exm-eyebrow mb-2">Kolejka</p>
      <ol className="divide-y divide-[rgba(255,255,255,0.06)] rounded-[var(--exm-r-field)] border border-exm-line">
        {list.map((x) => {
          const on = x.id === p.ep?.id;
          return (
            <li key={x.id}>
              <button type="button" onClick={() => (on ? p.toggle() : p.play(x, 0))} aria-current={on ? "true" : undefined}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-[14px] hover:bg-exm-surface ${on ? "text-exm-gold" : "text-exm-ivory"}`}>
                <span className="min-w-0 flex-1 truncate">{x.numer != null ? `#${x.numer} · ` : ""}{x.tytul}</span>
                {on && <span className="shrink-0 text-[11px] text-exm-gold">{p.playing ? "Teraz gra" : "Wstrzymane"}</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}