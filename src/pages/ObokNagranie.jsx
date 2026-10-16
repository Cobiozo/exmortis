import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Image } from "@/components/ui/image";
import { obok } from "@/components/obok/obokApi";
import ObokDenied from "@/components/obok/ObokDenied";
import ObokAudio from "@/components/obok/ObokAudio";
import ObokVideo from "@/components/obok/ObokVideo";
import RecordingExtras from "@/components/obok/RecordingExtras";

// Ekran nagrania: odtwarzacz zależny od formatu + pytanie na wieczór.
export default function ObokNagranie() {
  const { seria, numer } = useParams();
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => { obok("nagranie", { slug: seria, numer: Number(numer) }).then(setD).catch((e) => setErr(e?.response?.data || {})); }, [seria, numer]);
  if (err) return <ObokDenied info={err} />;
  if (!d) return (
    <section className="px-5 md:px-10 pt-32 pb-24" aria-busy="true">
      <div className="mx-auto max-w-[70ch]">
        <div className="h-3 w-16 bg-[#141416] animate-pulse motion-reduce:animate-none" />
        <div className="h-9 w-1/2 bg-[#141416] animate-pulse motion-reduce:animate-none mt-6 mb-8" />
        <div className="aspect-video bg-[#141416] animate-pulse motion-reduce:animate-none mb-6" />
        <div className="h-20 border hairline bg-[#141416] animate-pulse motion-reduce:animate-none" />
      </div>
    </section>
  );
  const { n } = d;
  const save = (pozycja, ukonczone) => obok("progress", { slug: seria, numer: n.numer, pozycja, ukonczone }).catch(() => {});
  const img = n.obraz || d.seria.okladka;
  return (
    <section className="px-5 md:px-10 pt-32 pb-24" onContextMenu={(e) => e.preventDefault()}>
      <div className="mx-auto max-w-[70ch]">
        <Link to={`/obok/${seria}`} className="technical text-[10px] gold-text">← {d.seria.nazwa.toUpperCase()}</Link>
        <h1 className="relic-heading text-3xl md:text-4xl text-[#F5EFE1] mt-6 mb-8">{n.tytul}</h1>
        {n.ostrzezenie && <div className="border border-[#BC1E22] p-5 mb-8 text-sm text-foreground/75">To nagranie dotyka trudnych tematów. Jeśli jest Ci bardzo ciężko: <strong>116 123</strong>, <strong>800 70 2222</strong>, w zagrożeniu życia <strong>112</strong>.</div>}
        {n.format === "wideo" ? <ObokVideo n={n} poster={img} onSave={save} /> : (
          <>
            {img && <Image src={img} alt="" draggable={false} className={`w-full mb-6 select-none ${n.format === "audio_obraz" ? "aspect-video" : "aspect-square max-w-sm mx-auto"}`} />}
            <ObokAudio n={n} seria={d.seria} onSave={save} />
          </>
        )}
        <RecordingExtras n={n} />
      </div>
    </section>
  );
}