import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

function Row({ label, value, hint }) {
  return (
    <div className="flex items-baseline justify-between border-b hairline py-2.5">
      <span className="text-sm text-foreground/70">{label}</span>
      <span className="technical text-[10px] text-[#F5EFE1]/70">
        {value}
        {hint ? <span className="text-foreground/35"> · {hint}</span> : null}
      </span>
    </div>
  );
}

// Minutnik ciszy — anonimowe statystyki sesji.
export default function SilenceStatsPanel() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    base44.functions
      .invoke("silenceAdmin", { action: "stats" })
      .then((res) => setStats(res.data))
      .catch(() => setStats(false));
  }, []);

  if (stats === null) {
    return (
      <div className="py-10 flex justify-center">
        <div className="w-8 h-8 border-4 border-[#3D3D3F] border-t-[#C9A24A] rounded-full animate-spin" />
      </div>
    );
  }
  if (stats === false) {
    return <p className="text-sm text-foreground/50">Nie udało się pobrać statystyk.</p>;
  }

  const t = stats.totals || { sessions: 0, completed: 0 };
  const pct = t.sessions ? Math.round((t.completed / t.sessions) * 100) : 0;
  const durations = stats.durations || [];
  const top = durations.slice().sort((a, b) => b.count - a.count)[0];

  return (
    <div>
      <p className="technical text-[11px] gold-text mb-2">MINUTNIK CISZY · STATYSTYKI</p>

      {t.sessions === 0 ? (
        <p className="text-sm text-foreground/40 mt-6">Jeszcze żadnej sesji.</p>
      ) : (
        <>
          <div className="grid sm:grid-cols-3 gap-6 mt-8 mb-12">
            <div className="border hairline p-6">
              <p className="technical text-[9px] text-foreground/40 mb-2">SESJE RAZEM</p>
              <p className="shop-heading text-4xl text-[#F5EFE1]">{t.sessions}</p>
            </div>
            <div className="border hairline p-6">
              <p className="technical text-[9px] text-foreground/40 mb-2">UKOŃCZONE</p>
              <p className="shop-heading text-4xl text-[#C9A24A]">{pct}%</p>
              <p className="text-xs text-foreground/35 mt-1">{t.completed} z {t.sessions}</p>
            </div>
            <div className="border hairline p-6">
              <p className="technical text-[9px] text-foreground/40 mb-2">NAJCZĘŚCIEJ WYBIERANY</p>
              <p className="shop-heading text-4xl text-[#F5EFE1]">{top?.duration_minutes} min</p>
              <p className="text-xs text-foreground/35 mt-1">{top?.count} sesji</p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            <div>
              <p className="technical text-[9px] text-foreground/40 mb-3">CZASY</p>
              {durations.map((d) => (
                <Row
                  key={d.duration_minutes}
                  label={`${d.duration_minutes} min`}
                  value={`${d.count}`}
                  hint={`uk. ${d.completed}`}
                />
              ))}
            </div>
            <div>
              <p className="technical text-[9px] text-foreground/40 mb-3">ŹRÓDŁA WEJŚĆ</p>
              {(stats.sources || []).map((s) => (
                <Row key={s.source} label={s.source} value={`${s.count}`} />
              ))}
            </div>
            <div>
              <p className="technical text-[9px] text-foreground/40 mb-3">TYGODNIE</p>
              {(stats.weeks || []).map((w) => (
                <Row key={w.week} label={w.week} value={`${w.count}`} />
              ))}
              <p className="technical text-[9px] text-foreground/40 mt-6 mb-3">DNI (OSTATNIE 14)</p>
              {(stats.days || []).slice(0, 14).map((d) => (
                <Row key={d.day} label={d.day} value={`${d.count}`} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}