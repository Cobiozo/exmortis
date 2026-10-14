import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Play, Search } from "lucide-react";
import { TEMATY, fmtT } from "./podcastUtils";

// Zakładki playlist, filtr tematów, wyszukiwarka, „Pokaż więcej”.
export default function EpisodeList({ episodes, playlists }) {
  const [pl, setPl] = useState("");
  const [topic, setTopic] = useState("");
  const [q, setQ] = useState("");
  const [n, setN] = useState(10);

  const shown = useMemo(() => {
    const ids = pl && playlists.find((p) => p.id === pl)?.odcinki;
    let l = ids ? ids.map((id) => episodes.find((e) => e.id === id)).filter(Boolean) : episodes;
    if (topic) l = l.filter((e) => e.tematy?.includes(topic));
    const s = q.trim().toLowerCase();
    if (s) l = l.filter((e) => [e.tytul, e.gosc_nazwa, e.transkrypcja].some((x) => x?.toLowerCase().includes(s)));
    return l;
  }, [episodes, playlists, pl, topic, q]);

  const tab = (on) => `technical text-[10px] px-4 py-2 border ${on ? "border-[#C9A24A] gold-text" : "hairline text-foreground/55 hover:text-foreground"}`;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setPl("")} className={tab(!pl)}>WSZYSTKIE</button>
        {playlists.map((p) => <button key={p.id} onClick={() => setPl(p.id)} className={tab(pl === p.id)}>{p.nazwa.toUpperCase()}</button>)}
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <select value={topic} onChange={(e) => setTopic(e.target.value)} className="bg-[#0A0A0B] border hairline px-4 py-3 text-sm">
          <option value="">Wszystkie tematy</option>
          {TEMATY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <label className="flex-1 flex items-center gap-2 border hairline px-4"><Search className="h-4 w-4 text-foreground/55" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj w tytułach, gościach i transkrypcjach" className="flex-1 bg-transparent py-3 text-sm focus:outline-none" />
        </label>
      </div>
      <ul className="divide-y hairline border-y hairline">
        {shown.slice(0, n).map((e) => (
          <li key={e.id}>
            <Link to={`/glos/${e.slug}`} className="py-5 flex items-center gap-5 group">
              <span className="font-mono text-sm gold-text w-10">#{e.numer ?? "—"}</span>
              <span className="flex-1 min-w-0">
                <span className="block shop-heading text-lg text-[#F5EFE1] group-hover:text-[#C9A24A] truncate">{e.tytul}</span>
                <span className="block text-xs text-foreground/55">{[e.gosc_nazwa, new Date(e.publikacja).toLocaleDateString("pl-PL"), e.dlugosc_s && fmtT(e.dlugosc_s)].filter(Boolean).join(" · ")}</span>
              </span>
              <Play className="h-4 w-4 gold-text shrink-0" />
            </Link>
          </li>
        ))}
        {!shown.length && <li className="py-8 text-sm text-foreground/55">Brak odcinków dla tego wyboru.</li>}
      </ul>
      {shown.length > n && <button onClick={() => setN(n + 10)} className="btn-ghost">Pokaż więcej</button>}
    </div>
  );
}