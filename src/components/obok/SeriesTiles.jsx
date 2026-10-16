import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Image } from "@/components/ui/image";
import { obok, when } from "./obokApi";

// Kafelki serii: postęp, następne nagranie, „Słuchaj”. Ten sam widok w /obok i w koncie.
export default function SeriesTiles() {
  const [tiles, setTiles] = useState(null);
  const [err, setErr] = useState(false);
  const load = () => { setErr(false); setTiles(null); obok("home").then((d) => setTiles(d.tiles)).catch(() => setErr(true)); };
  useEffect(load, []);
  if (err) return (
    <div className="text-center py-10">
      <p className="text-foreground/60 mb-4">Nie udało się wczytać serii.</p>
      <button onClick={load} className="btn-ghost !py-2 !px-4">Ponów</button>
    </div>
  );
  if (!tiles) return <p className="technical text-[10px] text-foreground/55">WCZYTUJĘ…</p>;
  if (!tiles.length) return <p className="text-foreground/60">Nie należysz jeszcze do żadnej serii.</p>;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {tiles.map((t) => (
        <Link key={t.id} to={`/obok/${t.slug}`} className="border hairline hover:border-[#C9A24A] transition-colors block">
          {t.okladka ? <Image src={t.okladka} alt="" className="aspect-square w-full" /> : <div className="aspect-square bg-[#121110] flex items-center justify-center relic-heading text-2xl gold-text px-6 text-center">{t.nazwa}</div>}
          <div className="p-5">
            <p className="relic-heading text-lg text-[#F5EFE1] mb-2">{t.nazwa}</p>
            <p className="text-sm text-foreground/55 mb-4">{t.heard} z {t.total}</p>
            {t.next && <p className="text-sm text-foreground/60 mb-4">{t.next.tytul} — {when(t.next.at)}</p>}
            <span className="technical text-[10px] gold-text">SŁUCHAJ →</span>
          </div>
        </Link>
      ))}
    </div>
  );
}