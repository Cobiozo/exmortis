import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { siteStats } from "@/lib/siteStats";
import { playKey } from "@/lib/playStats";
import { useAuth } from "@/lib/AuthContext";

// ODTWORZENIA (19.11.2026) — starty odcinków podcastu i utworów z zakładki Głos, z anonimowego licznika
// (zdarzenia „pod_…” i „muz_…”, sumy dzienne). Widoczne wyłącznie dla roli admin (decyzja Dawida).
const DAY = 86400000;

function PlayTable({ title, rows, empty }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="border hairline p-5 min-w-0">
      <p className="technical text-[11px] gold-text mb-4">{title}</p>
      {rows.length === 0 ? <p className="text-sm text-foreground/50">{empty}</p> : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.key} className="text-sm">
              <div className="flex justify-between gap-3">
                <span className="truncate text-foreground/80" title={r.title}>{r.title}</span>
                <span className="font-mono gold-text shrink-0">{r.n}<span className="text-foreground/40"> · 7 dni: {r.n7}</span></span>
              </div>
              <div className="h-1 bg-foreground/10 mt-1"><div className="h-1 bg-[#C9A24A]/70" style={{ width: `${(r.n / max) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PlaysPanel({ range }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState(null);
  const [names, setNames] = useState({ pod: {}, muz: {} });

  useEffect(() => {
    if (!isAdmin) return;
    siteStats(90).then(setRows).catch(() => setRows(false));
    Promise.all([
      base44.entities.PodcastEpisode.filter({}, { limit: 200 }).catch(() => ({ items: [] })),
      base44.entities.Utwor.filter({}, { limit: 200 }).catch(() => ({ items: [] })),
    ]).then(([eps, songs]) => {
      const pod = {}, muz = {};
      for (const e of eps.items || eps || []) { pod[playKey(e.slug || e.tytul)] = e.tytul; pod[playKey(e.tytul)] = e.tytul; }
      for (const s of songs.items || songs || []) muz[playKey(s.tytul)] = s.tytul;
      setNames({ pod, muz });
    });
  }, [isAdmin]);

  const data = useMemo(() => {
    if (!rows) return null;
    const from = new Date(Date.now() - (range - 1) * DAY).toISOString().slice(0, 10);
    const from7 = new Date(Date.now() - 6 * DAY).toISOString().slice(0, 10);
    const group = (prefix, map) => {
      const m = new Map();
      for (const r of rows) {
        if (r.kind !== "zdarzenie" || !String(r.name).startsWith(prefix + "_")) continue;
        const key = String(r.name).slice(prefix.length + 1);
        const cur = m.get(key) || { key, title: map[key] || key.replace(/_/g, " "), n: 0, n7: 0 };
        if (String(r.day) >= from) cur.n += Number(r.n || 0);
        if (String(r.day) >= from7) cur.n7 += Number(r.n || 0);
        m.set(key, cur);
      }
      return [...m.values()].filter((x) => x.n > 0 || x.n7 > 0).sort((a, b) => b.n - a.n);
    };
    const pod = group("pod", names.pod), muz = group("muz", names.muz);
    return { pod, muz, podSum: pod.reduce((s, x) => s + x.n, 0), muzSum: muz.reduce((s, x) => s + x.n, 0) };
  }, [rows, names, range]);

  if (!isAdmin) return null;
  if (rows === false) return <p className="text-sm text-foreground/55 mb-10">Nie udało się wczytać statystyk odtworzeń.</p>;
  if (!data) return null;

  return (
    <div className="mb-12">
      <p className="technical text-[11px] gold-text mb-2">ODTWORZENIA · TYLKO DLA ADMINISTRATORA</p>
      <p className="text-sm text-foreground/70 mb-6">
        W ostatnich {range} dniach: podcast {data.podSum}, muzyka {data.muzSum} odtworzeń.
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        <PlayTable title="PODCAST — ODCINKI" rows={data.pod} empty="Brak odtworzeń w tym okresie." />
        <PlayTable title="MUZYKA — UTWORY" rows={data.muz} empty="Brak odtworzeń w tym okresie." />
      </div>
      <p className="text-xs text-foreground/50 mt-4">
        Liczy się każde rozpoczęcie odcinka lub utworu na stronie Głos (także kolejny utwór odtworzony automatycznie), bez cookies i danych osób.
        Wznowienie po pauzie nie liczy się drugi raz. Odsłuchy w Spotify i YouTube poza stroną nie są tu widoczne. Dane od 19.11.2026.
      </p>
    </div>
  );
}
