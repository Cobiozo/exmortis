import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import MiniPlayer from "./MiniPlayer";

// Jeden odtwarzacz podcastu dla całej strony — gra dalej między podstronami.
const Ctx = createContext(null);
export const usePodcastPlayer = () => useContext(Ctx);
export const savedPos = (id) => Number(localStorage.getItem(`pod_pos_${id}`)) || 0;

export function PodcastPlayerProvider({ children }) {
  const a = useRef(null);
  const [ep, setEp] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [rate, setRateS] = useState(1);
  const { pathname } = useLocation();
  // Kolejka (19.11.2026): lista odcinków z playlisty Głosu — po końcu odcinka startuje następny z kolejki.
  const queueRef = useRef([]);
  const playRef = useRef(null);

  if (!a.current && typeof Audio !== "undefined") a.current = new Audio();
  useEffect(() => {
    const el = a.current;
    // timeupdate przychodzi ~4 razy na sekundę — stan (i przerysowanie odbiorców) najwyżej raz na sekundę.
    let lastSec = -1;
    const tick = () => {
      const sec = Math.floor(el.currentTime);
      if (sec === lastSec) return;
      lastSec = sec;
      setT(el.currentTime);
      if (sec % 5 === 0 && el.dataset.id) { try { localStorage.setItem(`pod_pos_${el.dataset.id}`, String(sec)); } catch { /* brak pamięci */ } }
    };
    const on = () => setPlaying(true), off = () => setPlaying(false), md = () => setDur(el.duration || 0);
    const end = () => {
      localStorage.removeItem(`pod_pos_${el.dataset.id}`); setPlaying(false);
      const q = queueRef.current || [];
      const i = q.findIndex((x) => String(x.id) === String(el.dataset.id));
      const next = i >= 0 ? q.slice(i + 1).find((x) => x.audio) : null;
      if (next && playRef.current) playRef.current(next, 0);
    };
    el.addEventListener("timeupdate", tick); el.addEventListener("play", on); el.addEventListener("pause", off);
    el.addEventListener("loadedmetadata", md); el.addEventListener("ended", end);
    return () => { el.pause(); };
  }, []);

  // Wejście na /cisza zatrzymuje odcinek.
  useEffect(() => { if (pathname.startsWith("/cisza")) a.current?.pause(); }, [pathname]);

  const play = (episode, from) => {
    const el = a.current;
    if (ep?.id !== episode.id) {
      el.src = episode.audio; el.dataset.id = episode.id; setEp(episode); setT(0); setDur(episode.dlugosc_s || 0);
      // Licznik odtworzeń — tylko start nowego odcinka (wznowienie nie liczy się drugi raz).
      if (episode.audio) { try { base44.functions.invoke("podcastPlay", { id: episode.id }).catch(() => {}); } catch { /* bez licznika */ } }
    }
    if (from != null) el.currentTime = from;
    el.playbackRate = rate;
    el.play().catch(() => {});
  };
  playRef.current = play;
  const api = {
    ep, playing, t, dur, rate, play,
    setQueue: (list) => { queueRef.current = Array.isArray(list) ? list : []; },
    toggle: () => (a.current.paused ? a.current.play().catch(() => {}) : a.current.pause()),
    seek: (s) => { a.current.currentTime = Math.max(0, s); setT(a.current.currentTime); },
    skip: (d) => { a.current.currentTime = Math.max(0, a.current.currentTime + d); },
    setRate: (r) => { a.current.playbackRate = r; setRateS(r); },
    close: () => { a.current.pause(); setEp(null); },
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      {/* Na /glos odtwarzacz jest w playliście — bez drugiego paska na dole. */}
      {ep && !pathname.startsWith("/cisza") && pathname.replace(/\/+$/, "") !== "/glos" && !pathname.startsWith(ep.href || `/glos/${ep.slug}`) && <MiniPlayer />}
    </Ctx.Provider>
  );
}