import React from "react";
import { Check, ListMusic } from "lucide-react";

// Playlisty muzyczne przy utworze (27.11.2026): zaznaczenie dodaje utwór na koniec playlisty, odznaczenie go usuwa.
// Zapis razem z utworem (SongForm → savePlaylists).
export default function SongPlaylists({ playlists, selected, onChange }) {
  if (!playlists) return <p className="text-xs text-foreground/45">Ładuję playlisty…</p>;
  const toggle = (id) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <div className="space-y-2">
      <span className="flex items-center gap-1.5 text-xs text-foreground/60"><ListMusic className="h-3.5 w-3.5" /> Playlisty muzyczne</span>
      {!playlists.length ? (
        <p className="text-xs text-foreground/45">Nie ma jeszcze playlist. Utworzysz je w zakładce „Playlisty muzyczne”.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {playlists.map((p) => {
            const on = selected.includes(p.id);
            return (
              <button key={p.id} type="button" onClick={() => toggle(p.id)} aria-pressed={on}
                className={`inline-flex items-center gap-1.5 border px-3 py-1.5 text-xs transition-colors ${on ? "border-[#C9A24A] bg-[#C9A24A]/10 gold-text" : "hairline text-foreground/60 hover:text-foreground"}`}>
                {on && <Check className="h-3 w-3" />}{p.nazwa}{p.widoczna ? "" : " · ukryta"}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
