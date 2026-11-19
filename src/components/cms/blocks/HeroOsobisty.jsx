import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, BookOpen, CalendarDays, Headphones, Pause, Play } from "lucide-react";
import { CmsButton } from "../parts";
import SafeImg from "../SafeImg";
import { nbsp } from "@/lib/nbsp";
import { track } from "@/lib/track";
import { nextPublicEvent } from "@/lib/publicEvents";
import { usePodcastPlayer } from "@/components/exmortis/podcast/PlayerContext";
import { loadLatestEpisode } from "@/components/exmortis/podcast/podcastUtils";
import { extractVideoId } from "@/components/exmortis/glos/youtube";
import useMarketingConsent from "@/lib/useMarketingConsent";

// Nagłówek strony głównej, wariant „osobisty” (17.11.2026): tekst po lewej, portret po prawej,
// pod portretem odtwarzacz (podcast albo muzyka — gra dopiero po kliknięciu), pod spodem pasek skrótów.
// Wygląd jak w Moim koncie: karty z zaokrągleniem 16 px, cienka ramka, przyciski Inter.
const TZ = "Europe/Warsaw";
const CARD = "rounded-2xl border hairline bg-[#111113]";
const MUSIC_URL = "https://youtu.be/SRBc9PiYhfo";

function Odtwarzacz({ d }) {
  const player = usePodcastPlayer();
  const consent = useMarketingConsent();
  const [tab, setTab] = useState("podcast");
  const [ep, setEp] = useState(undefined); // undefined = wczytuję, null = brak odcinka
  const [video, setVideo] = useState(false);
  const yt = extractVideoId(d.muzyka_url || MUSIC_URL);
  const songTitle = d.muzyka_tytul || "exmortis";

  // Tylko opis odcinka (tytuł i adres pliku); samo nagranie ładuje się po kliknięciu „Odtwórz”.
  useEffect(() => { loadLatestEpisode().then(setEp).catch(() => setEp(null)); }, []);

  const current = !!(ep && player?.ep?.id === ep.id);
  const playing = current && player.playing;
  const pct = current && player.dur ? Math.min(100, (player.t / player.dur) * 100) : 0;

  const playPodcast = () => {
    if (!ep || !player) return;
    if (current) { player.toggle(); return; }
    track("home_player_play", { co: "podcast" });
    player.play({ ...ep, href: `/glos/${ep.slug}` });
  };
  const playSong = () => {
    if (player?.playing) player.toggle(); // jedno nagranie naraz
    track("home_player_play", { co: "muzyka" });
    setVideo(true);
  };
  const pick = (t) => { setTab(t); if (t === "podcast") setVideo(false); };
  const seg = (t) => `h-8 px-3.5 rounded-full text-xs font-medium transition-colors ${tab === t ? "bg-[#C9A24A]/[0.16] text-[#F5EFE1]" : "text-[#F5EFE1]/65 hover:text-[#F5EFE1]"}`;
  const btn = "h-12 w-12 shrink-0 rounded-full bg-[#C9A24A] text-[#0A0A0B] inline-flex items-center justify-center hover:bg-[#E2C27A] transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A24A]";

  return (
    <div className={`${CARD} relative p-4 md:p-[18px] shadow-[0_24px_48px_rgba(0,0,0,.5)] bg-[#111113]/[0.97]`}>
      <div className="flex items-center justify-between gap-3">
        <p className="technical text-[10px] text-[#F5EFE1]/60">POSŁUCHAJ</p>
        <div role="group" aria-label="Wybierz, co odtworzyć" className="inline-flex p-[3px] rounded-full bg-[#0A0A0B] border hairline">
          <button type="button" aria-pressed={tab === "podcast"} onClick={() => pick("podcast")} className={seg("podcast")}>Podcast</button>
          <button type="button" aria-pressed={tab === "muzyka"} onClick={() => pick("muzyka")} className={seg("muzyka")}>Muzyka</button>
        </div>
      </div>

      {tab === "podcast" ? (
        <>
          <div className="flex items-center gap-3.5 mt-3.5">
            <button type="button" onClick={playPodcast} disabled={!ep} className={btn}
              aria-label={ep ? `${playing ? "Wstrzymaj" : "Odtwórz"}: ${ep.tytul}` : "Odtwórz odcinek"}>
              {playing ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="h-4 w-4 translate-x-px" fill="currentColor" />}
            </button>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-[#F5EFE1] truncate">{ep ? ep.tytul : ep === null ? "Odcinki są w Głosie" : " "}</span>
              <span className="block text-xs text-[#F5EFE1]/60 mt-0.5">Głos · podcast EXMORTIS</span>
            </span>
            <Link to="/glos?src=home-player" className="text-[13px] gold-text hover:underline underline-offset-4 shrink-0">Wszystkie →</Link>
          </div>
          <div className="mt-3.5 h-[3px] rounded-full bg-[#26262A]" aria-hidden="true">
            <div className="h-full rounded-full bg-[#C9A24A] transition-[width] duration-700" style={{ width: `${pct}%` }} />
          </div>
        </>
      ) : video && yt ? (
        <div className="mt-3.5 rounded-xl overflow-hidden border hairline aspect-video">
          <iframe className="w-full h-full" src={`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1`} title={`${songTitle} — piosenka`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3.5 mt-3.5">
            <button type="button" onClick={playSong} disabled={!yt} className={btn} aria-label={`Odtwórz piosenkę „${songTitle}”`}>
              <Play className="h-4 w-4 translate-x-px" fill="currentColor" />
            </button>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-[#F5EFE1] truncate">{songTitle}</span>
              <span className="block text-xs text-[#F5EFE1]/60 mt-0.5">Piosenka · moja historia powrotu</span>
            </span>
            <Link to="/o-mnie" className="text-[13px] gold-text hover:underline underline-offset-4 shrink-0">O mnie →</Link>
          </div>
          {!consent && <p className="mt-3 text-[11px] text-[#F5EFE1]/55">Odtwarzacz YouTube: po kliknięciu YouTube otrzyma Twój adres IP.</p>}
        </>
      )}
    </div>
  );
}

function Skroty() {
  const [ev, setEv] = useState(undefined);
  useEffect(() => { nextPublicEvent().then(setEv).catch(() => setEv(null)); }, []);
  const when = ev ? (() => {
    const t = new Date(ev.start_datetime);
    const day = t.toLocaleDateString("pl-PL", { day: "numeric", month: "long", timeZone: TZ });
    const hour = t.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
    return `Najbliższe: ${day}, ${hour} · ${ev.format === "Online" ? "online" : "na żywo"}`;
  })() : "Otwarte spotkania EXMORTIS";
  const items = [
    { cel: "czytaj", Icon: BookOpen, t: "Czytaj", s: "Materiały ze Skarbca", to: "/skarbiec?src=home-skrot" },
    { cel: "posluchaj", Icon: Headphones, t: "Posłuchaj", s: "Podcast i muzyka", to: "/glos?src=home-skrot" },
    { cel: "spotkanie", Icon: CalendarDays, t: "Weź udział w spotkaniu", s: when, to: ev ? `/spotkania/${ev.slug}` : "/spotkania?src=home-skrot" },
  ];
  return (
    <nav aria-label="Na skróty" className="mt-12 lg:mt-14 grid md:grid-cols-3 border-y hairline">
      {items.map(({ cel, Icon, t, s, to }, i) => (
        <Link key={cel} to={to} onClick={() => track("home_skrot_click", { cel })}
          className={`group flex items-center gap-4 min-h-[72px] py-4 md:py-6 md:px-6 ${i === 0 ? "md:pl-0" : "border-t md:border-t-0 md:border-l hairline"} ${i === 2 ? "md:pr-0" : ""} hover:bg-white/[0.02] transition-colors`}>
          <Icon className="h-6 w-6 gold-text shrink-0" strokeWidth={1.4} aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-base md:text-[17px] font-medium text-[#F5EFE1]">{t}</span>
            <span className="block text-[13px] text-[#F5EFE1]/60 mt-0.5">{s}</span>
          </span>
          <ArrowUpRight className="h-[18px] w-[18px] text-[#F5EFE1]/55 group-hover:text-[#C9A24A] transition-colors shrink-0" aria-hidden="true" />
        </Link>
      ))}
    </nav>
  );
}

export default function HeroOsobisty({ d }) {
  const list = d.przyciski || [];
  const [first, ...rest] = list;
  const img = d.autor_zdjecie?.url ? { fx: 50, fy: 24, ...d.autor_zdjecie, alt: d.autor_zdjecie.alt || "Dawid, twórca EXMORTIS" } : null;
  return (
    <section className="exm-soft relative overflow-hidden bg-[#0A0A0B]"
      style={{ background: "radial-gradient(60% 70% at 78% 28%, rgba(201,162,74,.10), transparent 70%), #0A0A0B" }}>
      <div className="relative mx-auto max-w-[1200px] px-4 sm:px-5 md:px-10 xl:px-0 pt-[92px] md:pt-28 lg:pt-32 pb-12 md:pb-16">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px] gap-10 lg:gap-16 xl:gap-20 items-center">
          <div className="min-w-0">
            {d.etykieta && <p className="technical text-[11px] gold-text mb-5">{d.etykieta}</p>}
            <h1 className="shop-heading text-[clamp(2.35rem,10.5vw,3.1rem)] md:text-[3.6rem] lg:text-[4rem] xl:text-[4.5rem] leading-[1.04] text-[#F5EFE1] max-w-[15ch]">
              {nbsp(d.linia1)}{d.linia2 && <>{" "}<em className="italic text-[#C9A24A]">{nbsp(d.linia2)}</em></>}
            </h1>
            {d.lead && <p className="no-hyph mt-6 text-[17px] md:text-[19px] leading-[1.6] text-[#F5EFE1]/[0.82] max-w-[34em]">{nbsp(d.lead)}</p>}
            {d.podlead && <p className="no-hyph mt-3 text-[15px] md:text-base leading-relaxed text-[#F5EFE1]/60 max-w-[34em]">{nbsp(d.podlead)}</p>}
            {first && (
              <div className="mt-8 flex flex-col sm:flex-row sm:flex-wrap gap-3">
                <CmsButton b={first} />
                {rest.map((b, i) => <CmsButton key={i} b={b} />)}
              </div>
            )}
            {d.podpis_przycisku && <p className="mt-3 text-[13px] text-[#F5EFE1]/60">{d.podpis_przycisku}</p>}
          </div>

          <div className="min-w-0 w-full max-w-[440px] mx-auto lg:mx-0">
            {img && (
              <figure className={`${CARD} relative overflow-hidden aspect-[1/1] sm:aspect-[6/7] m-0`}>
                <SafeImg img={img} eager sizes="(min-width: 1024px) 440px, 100vw" className="absolute inset-0" imgClass="saturate-[.85]" />
                <figcaption className="absolute inset-x-0 bottom-0 pt-16 pb-14 px-5 md:px-6 bg-gradient-to-t from-[#0A0A0B]/95 to-transparent flex items-end justify-between gap-3">
                  {d.autor_podpis && <span className="shop-heading text-[26px] md:text-[30px] leading-none text-[#F5EFE1]">{d.autor_podpis}</span>}
                  {d.autor_rola && <span className="technical text-[10px] gold-text text-right">{d.autor_rola}</span>}
                </figcaption>
              </figure>
            )}
            {!d.ukryj_odtwarzacz && <div className={`relative ${img ? "-mt-10 mx-3 lg:mx-0 lg:-ml-9 lg:mr-9" : ""}`}><Odtwarzacz d={d} /></div>}
          </div>
        </div>
        {!d.ukryj_skroty && <Skroty />}
      </div>
    </section>
  );
}
