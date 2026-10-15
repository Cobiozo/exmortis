import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
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
    const end = () => { localStorage.removeItem(`pod_pos_${el.dataset.id}`); setPlaying(false); };
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
    }
    if (from != null) el.currentTime = from;
    el.playbackRate = rate;
    el.play().catch(() => {});
  };
  const api = {
    ep, playing, t, dur, rate, play,
    toggle: () => (a.current.paused ? a.current.play().catch(() => {}) : a.current.pause()),
    seek: (s) => { a.current.currentTime = Math.max(0, s); setT(a.current.currentTime); },
    skip: (d) => { a.current.currentTime = Math.max(0, a.current.currentTime + d); },
    setRate: (r) => { a.current.playbackRate = r; setRateS(r); },
    close: () => { a.current.pause(); setEp(null); },
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      {ep && !pathname.startsWith("/cisza") && !pathname.startsWith(ep.href || `/glos/${ep.slug}`) && <MiniPlayer />}
    </Ctx.Provider>
  );
}