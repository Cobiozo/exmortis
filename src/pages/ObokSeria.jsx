import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Lock, Play, Check } from "lucide-react";
import { obok, when, mins } from "@/components/obok/obokApi";
import ObokDenied from "@/components/obok/ObokDenied";

// Lista nagrań serii: otwarte i z kłódką (bez przeskakiwania harmonogramu).
export default function ObokSeria() {
  const { seria } = useParams();
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [tylkoNowe, setTylkoNowe] = useState(false);
  useEffect(() => { obok("seria", { slug: seria }).then(setD).catch((e) => setErr(e?.response?.data || {})); }, [seria]);
  if (err) return <ObokDenied info={err} />;
  if (!d) return <div className="min-h-screen" />;
  let list = d.nagrania;
  if (d.seria.typ === "cotygodniowa") list = [...list].reverse();
  if (tylkoNowe) list = list.filter((n) => !n.ukonczone);
  return (
    <section className="px-5 md:px-10 pt-32 pb-24">
      <div className="mx-auto max-w-[70ch]">
        <Link to="/obok" className="technical text-[10px] gold-text">← OBOK</Link>
        <h1 className="relic-heading text-4xl text-[#F5EFE1] mt-6 mb-4">{d.seria.nazwa}</h1>
        {d.seria.opis && <p className="text-foreground/65 mb-10 whitespace-pre-line">{d.seria.opis}</p>}
        {d.seria.typ === "cotygodniowa" && <label className="flex gap-2 items-center text-sm text-foreground/60 mb-6 min-h-[40px] cursor-pointer"><input type="checkbox" checked={tylkoNowe} onChange={(e) => setTylkoNowe(e.target.checked)} className="h-5 w-5 shrink-0 accent-[#C9A24A]" />Tylko nieodsłuchane</label>}
        <ul className="border-t hairline">
          {list.map((n) => n.open ? (
            <li key={n.numer}><Link to={`/obok/${d.seria.slug}/${n.numer}`} className="flex items-center gap-4 py-5 border-b hairline hover:text-[#C9A24A]">
              <Play className="h-4 w-4 gold-text shrink-0" /><span className="flex-1 text-[#F5EFE1]">{n.tytul}</span>
              <span className="text-sm text-foreground/45">{mins(n.dlugosc_s)}</span>{n.ukonczone && <Check className="h-4 w-4 gold-text" aria-label="Odsłuchane" />}
            </Link></li>
          ) : (
            <li key={n.numer} className="flex items-center gap-4 py-5 border-b hairline text-foreground/40">
              <Lock className="h-4 w-4 shrink-0" /><span className="flex-1">{n.tytul}</span>
              <span className="text-sm">{n.at ? `Otworzy się ${when(n.at)}` : "Wkrótce"}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}