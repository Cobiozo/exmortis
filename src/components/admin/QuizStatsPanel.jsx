import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

const TYPES = ["Mentalna", "Duchowa", "Życiowa", "Mieszana"];

// Statystyki testu „Która śmierć jest Twoja?" — podział na typy śmierci.
export default function QuizStatsPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.functions
      .invoke("adminQuiz", { action: "stats" })
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 border hairline animate-pulse bg-[#0F0F10]" />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-foreground/50 border hairline p-10 text-center">
        Nie udało się pobrać wyników testu.
      </p>
    );
  }

  const countOf = (t) => (data.counts.find((c) => c.dominant === t) || { count: 0 }).count;
  const total = data.total || 0;

  return (
    <div>
      <p className="technical text-[10px] text-foreground/40 mb-8">
        TEST „KTÓRA ŚMIERĆ JEST TWOJA?" · {total} {total === 1 ? "WYNIK" : "WYNIKÓW"}
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        {TYPES.map((t) => (
          <div key={t} className="border hairline p-6">
            <p className="shop-heading text-3xl gold-text">{countOf(t)}</p>
            <p className="technical text-[9px] text-foreground/40 mt-2">{t.toUpperCase()}</p>
            <p className="text-xs text-foreground/30 mt-1">
              {total > 0 ? `${Math.round((countOf(t) / total) * 100)}% wyników` : "—"}
            </p>
          </div>
        ))}
      </div>

      <p className="technical text-[10px] text-foreground/40 mb-4">OSTATNIE WYNIKI</p>
      {data.recent.length === 0 ? (
        <p className="text-foreground/50 border hairline p-8 text-center">
          Nie ma jeszcze żadnych wyników.
        </p>
      ) : (
        <div className="border hairline divide-y divide-[#3D3D3F]/40">
          {data.recent.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm hover:bg-[#0F0F10] transition-colors"
            >
              <span className="w-36 truncate text-foreground/70">{r.first_name || "—"}</span>
              <span className="w-56 truncate text-foreground/40">{r.email}</span>
              <span className="technical text-[9px] text-foreground/40">
                M {r.score_mental} · D {r.score_spiritual} · Ż {r.score_life}
              </span>
              <span className="technical text-[9px] gold-text ml-auto">{r.dominant.toUpperCase()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}