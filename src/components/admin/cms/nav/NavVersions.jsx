import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { smallBtn } from "../ui";

const when = (d) => new Date(d).toLocaleString("pl-PL", { dateStyle: "medium", timeStyle: "short" });

// Opublikowane wersje menu i stopki; wybraną można wczytać do szkicu.
export default function NavVersions({ refresh, onLoad }) {
  const [list, setList] = useState(null);
  useEffect(() => {
    base44.entities.PageVersion.filter({ slug: "_menu" }, { sort: "-wersja", limit: 20 }).then((p) => setList(p.items));
  }, [refresh]);
  return (
    <section className="space-y-3">
      <h3 className="relic-heading text-xl">Historia wersji</h3>
      {!list ? <p className="text-sm text-foreground/50">Wczytywanie…</p>
        : !list.length ? <p className="text-sm text-foreground/50">Brak opublikowanych wersji.</p>
        : list.map((v) => (
          <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 border hairline px-4 py-3">
            <div>
              <p className="technical text-[10px] gold-text">Wersja {v.wersja}</p>
              <p className="text-xs text-foreground/50">{when(v.created_date)}{v.kto ? ` · ${v.kto}` : ""}</p>
            </div>
            <button className={smallBtn} onClick={() => onLoad(v.bloki?.[0])}>Wczytaj do szkicu</button>
          </div>
        ))}
    </section>
  );
}