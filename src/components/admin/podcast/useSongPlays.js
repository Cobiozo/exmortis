import { useEffect, useState } from "react";
import { siteStats } from "@/lib/siteStats";
import { playKey } from "@/lib/playStats";

// Odsłuchania utworów z anonimowego licznika (zdarzenia „muz_<tytuł>”): ostatnie 90 dni i 7 dni.
const DAY = 86400000;

export default function useSongPlays() {
  const [map, setMap] = useState(null);
  useEffect(() => {
    const from7 = new Date(Date.now() - 6 * DAY).toISOString().slice(0, 10);
    siteStats(90).then((rows) => {
      const m = {};
      for (const r of rows || []) {
        if (r.kind !== "zdarzenie" || !String(r.name).startsWith("muz_")) continue;
        const k = String(r.name).slice(4);
        const cur = m[k] || (m[k] = { n: 0, n7: 0 });
        cur.n += Number(r.n || 0);
        if (String(r.day) >= from7) cur.n7 += Number(r.n || 0);
      }
      setMap(m);
    }).catch(() => setMap({}));
  }, []);
  return (title) => (map ? map[playKey(title)] || { n: 0, n7: 0 } : null);
}