import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import ContentWarning from "@/components/exmortis/podcast/ContentWarning";
import EpisodeMedia from "@/components/exmortis/podcast/EpisodeMedia";
import ShareBox from "@/components/exmortis/podcast/ShareBox";
import SubscribeLinks from "@/components/exmortis/podcast/SubscribeLinks";
import QuietSignup from "@/components/exmortis/podcast/QuietSignup";
import EpisodeSeo from "@/components/exmortis/podcast/EpisodeSeo";
import { usePodcastPlayer } from "@/components/exmortis/podcast/PlayerContext";
import { TEMATY, fmtT, parseT, parseChapters, loadPublished, loadSettings } from "@/components/exmortis/podcast/podcastUtils";

export default function PodcastEpisode() {
  const { slug } = useParams();
  const p = usePodcastPlayer();
  const [ep, setEp] = useState(undefined);
  const [settings, setSettings] = useState(null);
  const [more, setMore] = useState([]);
  const [showTr, setShowTr] = useState(false);
  const startAt = parseT(new URLSearchParams(window.location.search).get("t"));

  useEffect(() => {
    setEp(undefined);
    // Jak na liście: tylko odcinki, których data publikacji już nadeszła —
    // zaplanowany odcinek nie może być dostępny pod bezpośrednim adresem.
    const now = new Date().toISOString();
    base44.entities.PodcastEpisode.filter(
      { slug, status: { $in: ["opublikowany", "zaplanowany"] }, publikacja: { $lte: now } },
      { limit: 1 }
    ).then((r) => setEp(r.items[0] || null));
    loadSettings().then(setSettings);
  }, [slug]);
  useEffect(() => {
    if (!ep) return;
    Promise.all([loadPublished(), base44.entities.PodcastPlaylist.filter({ odcinki: ep.id }, { limit: 1 })]).then(([all, pl]) => {
      const ids = pl.items[0]?.odcinki || all.map((e) => e.id);
      setMore(ids.filter((id) => id !== ep.id).map((id) => all.find((e) => e.id === id)).filter(Boolean).slice(0, 3));
    });
  }, [ep]);

  if (ep === undefined) return <div className="min-h-screen pt-40 text-center text-foreground/55">Ładowanie…</div>;
  if (!ep) return <div className="min-h-screen pt-40 text-center"><p className="relic-heading text-3xl mb-6">Nie ma takiego odcinka</p><Link to="/glos#podcast" className="btn-ghost">Wszystkie odcinki</Link></div>;

  const chapters = parseChapters(ep.rozdzialy);
  const jump = (t) => (ep.audio ? p.play(ep, t) : null);
  return (
    <article className="bg-[#0A0A0B] pt-32 pb-24 px-5 md:px-10">
      <EpisodeSeo ep={ep} settings={settings} />
      <div className="mx-auto max-w-3xl space-y-10">
        <Link to="/glos#podcast" className="technical text-[10px] text-foreground/55 hover:gold-text">← PODCAST EXMORTIS</Link>
        <header className="grid sm:grid-cols-[200px_1fr] gap-8 items-end">
          <Image src={ep.okladka || settings?.okladka} alt={ep.tytul} className="aspect-square w-full max-w-[200px] bg-[#121212]" />
          <div>
            <p className="technical text-[10px] gold-text mb-3">ODCINEK #{ep.numer}</p>
            <h1 className="shop-heading text-3xl md:text-5xl text-[#F5EFE1] leading-tight mb-4" style={{ textWrap: "balance" }}>{ep.tytul}</h1>
            <p className="text-sm text-foreground/55">{[ep.gosc_nazwa, new Date(ep.publikacja).toLocaleDateString("pl-PL"), ep.dlugosc_s && fmtT(ep.dlugosc_s)].filter(Boolean).join(" · ")}</p>
            {!!ep.tematy?.length && <p className="technical text-[9px] text-foreground/55 mt-3">{ep.tematy.map((t) => TEMATY.find((x) => x[0] === t)?.[1] || t).join(" · ")}</p>}
          </div>
        </header>
        <ContentWarning topics={ep.ostrzezenia} />
        <EpisodeMedia ep={ep} startAt={startAt} />
        {!!chapters.length && (
          <ol className="border-y hairline divide-y hairline">
            {chapters.map((c) => (
              <li key={c.t}><button onClick={() => jump(c.t)} disabled={!ep.audio} className="w-full text-left py-3 flex gap-4 text-sm hover:text-[#C9A24A]"><span className="font-mono gold-text w-16">{fmtT(c.t)}</span>{c.title}</button></li>
            ))}
          </ol>
        )}
        {ep.gosc_bio && <div className="border-l border-[#C9A24A]/40 pl-5"><p className="technical text-[10px] gold-text mb-2">GOŚĆ</p><p className="text-sm text-foreground/65 leading-relaxed">{ep.gosc_bio}</p></div>}
        {ep.notatki && <div className="rich-content text-foreground/70" dangerouslySetInnerHTML={{ __html: sanitizeHtml(ep.notatki) }} />}
        {!!ep.materialy?.length && <ul className="space-y-2">{ep.materialy.map((m) => <li key={m.url}><a href={m.url} target="_blank" rel="noreferrer" className="text-sm gold-text underline">{m.nazwa || m.url}</a></li>)}</ul>}
        {ep.cta_link && <a href={ep.cta_link} className="btn-relic">{ep.cta_etykieta || "Dalej"}</a>}
        {ep.transkrypcja && (
          <div>
            <button onClick={() => setShowTr(!showTr)} className="btn-ghost">{showTr ? "Ukryj transkrypcję" : "Pokaż transkrypcję"}</button>
            <div hidden={!showTr} className="mt-6 text-sm text-foreground/65 leading-relaxed whitespace-pre-line">{ep.transkrypcja}</div>
          </div>
        )}
        <ShareBox ep={ep} />
        <div className="space-y-3"><p className="technical text-[10px] text-foreground/55">SŁUCHAJ TEŻ NA</p><SubscribeLinks settings={{ spotify: ep.spotify || settings?.spotify, youtube: ep.youtube || settings?.youtube, apple: settings?.apple }} small /></div>
        {!!more.length && (
          <div className="space-y-3"><p className="technical text-[10px] text-foreground/55">KOLEJNE ODCINKI</p>
            {more.map((e) => <Link key={e.id} to={`/glos/${e.slug}`} className="block border hairline p-4 hover:border-[#C9A24A]"><span className="font-mono text-xs gold-text mr-3">#{e.numer}</span><span className="shop-heading text-lg text-[#F5EFE1]">{e.tytul}</span></Link>)}
          </div>
        )}
        <div className="border-t hairline pt-10"><QuietSignup lead="Jeden list w każdy poniedziałek — o drodze z powrotem." button="Zapisz się" source={`podcast-${ep.slug}`} /></div>
      </div>
    </article>
  );
}