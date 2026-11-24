import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { countPlay } from "@/lib/playStats";
import { base44 } from "@/api/base44Client";
import MiniPlayer from "./MiniPlayer";
import useMediaSession from "./useMediaSession";
import { kindOf, isMusic, saveState, loadState, clearState, verifyItem, podRate, savePodRate } from "./playerStore";

// Jeden odtwarzacz audio dla całej strony (podcast, muzyka, nagrania Obok) — jeden element <audio>,
// zamontowany nad trasami, więc gra dalej między podstronami. Karty, strony odcinków i belka sterują tą samą instancją.
const Ctx = createContext(null);
export const usePodcastPlayer = () => useContext(Ctx);
export const savedPos = (id) => Number(localStorage.getItem(`pod_pos_${id}`)) || 0;
export const subtitleOf = (x) => x?.autor || (isMusic(x) ? "EXMORTIS" : kindOf(x) === "obok" ? "Obok" : "Podcast Głos EXMORTIS");
const HIDE_ON = /^\/(admin|skaner)(\/|$)/;

export function PodcastPlayerProvider({ children }) {
  const a = useRef(null);
  if (!a.current && typeof Audio !== "undefined") { a.current = new Audio(); a.current.preload = "metadata"; }
  const [ep, setEp] = useState(null);
  const [queue, setQueueS] = useState([]);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState(false);
  const [restored, setRestored] = useState(false); // stan po odświeżeniu: belka z „Wznów”, plik jeszcze niewczytany
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [rate, setRateS] = useState(podRate);
  const [volume, setVolumeS] = useState(1);
  const [holds, setHolds] = useState(0);
  const { pathname } = useLocation();
  const R = useRef({});
  const queueRef = useRef([]);
  const pending = useRef(null);
  R.current = { ep, restored, error, rate, t };

  const want = (item) => (isMusic(item) ? 1 : R.current.rate);
  const load = (item, from) => {
    const el = a.current;
    setError(false); setRestored(false); setBuffering(true);
    pending.current = from || 0;
    el.defaultPlaybackRate = want(item);
    el.src = item.audio; el.dataset.id = item.id;
  };

  const play = (item, from) => {
    if (!item?.audio) return;
    const el = a.current;
    const cur = R.current;
    if (cur.ep?.id !== item.id) {
      setEp(item); setT(from || 0); setDur(item.dlugosc_s || 0);
      load(item, from);
      // Licznik odtworzeń — tylko start nowego nagrania (wznowienie nie liczy się drugi raz).
      if (kindOf(item) === "podcast") { try { base44.functions.invoke("podcastPlay", { id: item.id }).catch(() => {}); } catch { /* */ } countPlay("pod", item.slug || item.tytul); }
      if (isMusic(item)) countPlay("muz", item.tytul);
    } else if (cur.restored || cur.error) {
      load(item, from ?? cur.t);
    } else if (from != null) {
      el.currentTime = from;
    }
    el.play().catch(() => {});
  };

  const step = (dir) => {
    const q = queueRef.current, id = R.current.ep?.id;
    const i = q.findIndex((x) => String(x.id) === String(id));
    if (i < 0) return null;
    return dir > 0 ? q.slice(i + 1).find((x) => x.audio) : q.slice(0, i).reverse().find((x) => x.audio);
  };
  const next = () => { const n = step(1); if (n) play(n, 0); };
  const prev = () => {
    if (a.current.currentTime > 5) { a.current.currentTime = 0; return; }
    const p = step(-1); if (p) play(p, 0);
  };
  const pause = () => a.current?.pause();
  const resume = () => { const c = R.current; if (!c.ep) return; if (c.restored || c.error) play(c.ep, c.t); else a.current.play().catch(() => {}); };
  const seek = (s) => { const v = Math.max(0, Number(s) || 0); if (R.current.restored) { setT(v); return; } a.current.currentTime = v; setT(v); };
  const skip = (d) => seek((R.current.restored ? R.current.t : a.current.currentTime) + d);
  const persist = () => { const c = R.current; if (c.ep) saveState(c.ep, queueRef.current, a.current?.currentTime || c.t); };

  const H = useRef({}); H.current = { resume, pause, skip, seek, prev, next };

  useEffect(() => {
    const el = a.current;
    let lastSec = -1;
    const tick = () => {
      const sec = Math.floor(el.currentTime);
      if (sec === lastSec) return;
      lastSec = sec; setT(el.currentTime);
      if (sec % 5 === 0 && el.dataset.id) {
        try { localStorage.setItem(`pod_pos_${el.dataset.id}`, String(sec)); } catch { /* */ }
        persist();
      }
      try { if (el.duration) navigator.mediaSession?.setPositionState?.({ duration: el.duration, position: el.currentTime, playbackRate: el.playbackRate }); } catch { /* */ }
    };
    const onPlaying = () => { setPlaying(true); setBuffering(false); persist(); window.dispatchEvent(new Event("exm:audio-play")); };
    const onPause = () => { setPlaying(false); persist(); };
    const onWait = () => setBuffering(true);
    const onMeta = () => {
      setDur(el.duration || 0);
      el.playbackRate = want(R.current.ep);
      if (pending.current) { el.currentTime = pending.current; pending.current = null; }
    };
    const onEnd = () => {
      localStorage.removeItem(`pod_pos_${el.dataset.id}`); setPlaying(false);
      const n = step(1);
      if (n) play(n, 0); // koniec kolejki — odtwarzanie się zatrzymuje
    };
    const onErr = () => { if (!el.getAttribute("src")) return; setError(true); setPlaying(false); setBuffering(false); };
    const ev = { timeupdate: tick, playing: onPlaying, pause: onPause, waiting: onWait, loadedmetadata: onMeta, ended: onEnd, error: onErr };
    Object.entries(ev).forEach(([k, f]) => el.addEventListener(k, f));
    window.addEventListener("pagehide", persist);
    return () => { Object.entries(ev).forEach(([k, f]) => el.removeEventListener(k, f)); window.removeEventListener("pagehide", persist); el.pause(); };
  }, []);

  // Po odświeżeniu: przywracamy ostatnie nagranie bez dźwięku — start dopiero po kliknięciu „Wznów”.
  useEffect(() => {
    const s = loadState();
    if (!s?.item) return;
    verifyItem(s.item).then((fresh) => {
      if (R.current.ep) return;
      if (!fresh) { clearState(); return; }
      queueRef.current = s.queue || []; setQueueS(queueRef.current);
      setEp(fresh); setT(s.pos || 0); setDur(fresh.dlugosc_s || 0); setRestored(true);
    });
  }, []);

  useMediaSession(ep, subtitleOf(ep), H);

  const api = {
    ep, queue, playing, buffering, error, restored, t, dur, volume, play, pause, resume, next, prev, seek, skip,
    rate: isMusic(ep) ? 1 : rate,
    hasNext: !!step(1), hasPrev: !!step(-1),
    setQueue: (list) => { queueRef.current = Array.isArray(list) ? list : []; setQueueS(queueRef.current); },
    toggle: () => (a.current.paused || R.current.restored || R.current.error ? resume() : pause()),
    retry: () => { const c = R.current; if (c.ep) { load(c.ep, c.t); a.current.play().catch(() => {}); } },
    setRate: (r) => { setRateS(r); savePodRate(r); R.current.rate = r; if (!isMusic(R.current.ep)) a.current.playbackRate = r; },
    setVolume: (v) => { a.current.volume = v; setVolumeS(v); },
    // Belka znika, dźwięk staje; pozycja zostaje przy nagraniu („Kontynuuj od” na stronie odcinka).
    close: () => { a.current.pause(); clearState(); setEp(null); setRestored(false); setError(false); },
    // Np. sesja Ciszy: wstrzymuje dźwięk i chowa belkę na czas sesji.
    hold: (on) => setHolds((n) => Math.max(0, n + (on ? 1 : -1))),
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      {ep && !holds && !HIDE_ON.test(pathname) && <MiniPlayer />}
    </Ctx.Provider>
  );
}