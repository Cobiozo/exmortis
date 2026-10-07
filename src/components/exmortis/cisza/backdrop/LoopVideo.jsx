import React, { useEffect, useRef, useState } from "react";
import { Image } from "@/components/ui/image";
import { lowData } from "./backdrops";

// Wideo w pętli: zawsze bez dźwięku. Poster zamiast wideo przy oszczędzaniu, ukrytej karcie lub słabym urządzeniu.
export default function LoopVideo({ bg, still, pos }) {
  const ref = useRef(null);
  const [hidden, setHidden] = useState(() => document.hidden);
  const [weak, setWeak] = useState(false);
  const [ready, setReady] = useState(false);
  const play = !still && !hidden && !weak && !lowData() && !!bg.wideo_mp4;
  const mobile = window.innerWidth < 768 && bg.wideo_mobile;

  useEffect(() => {
    const f = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, []);

  useEffect(() => {
    const v = ref.current;
    if (!play) { setReady(false); return; }
    v.muted = true;
    v.defaultMuted = true;
    v.play().catch(() => {});
  }, [play]);

  // Jeśli przez 4 s klatki spadają poniżej 40/s — wracamy do postera.
  useEffect(() => {
    if (!play || !ready) return;
    let n = 0, raf;
    const t0 = performance.now();
    const tick = (t) => { n++; if (t - t0 < 4000) raf = requestAnimationFrame(tick); else if (n / 4 < 40) setWeak(true); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [play, ready]);

  return (
    <>
      {bg.poster && <Image src={bg.poster} alt="" className="absolute inset-0 w-full h-full" focalPointX={pos.x} focalPointY={pos.y} />}
      {play && (
        <video
          ref={ref} muted playsInline loop autoPlay preload="metadata" disablePictureInPicture
          onPlaying={() => setReady(true)}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
          style={{ opacity: ready ? 1 : 0, objectPosition: `${pos.x * 100}% ${pos.y * 100}%` }}
        >
          {bg.wideo_webm && !mobile && <source src={bg.wideo_webm} type="video/webm" />}
          <source src={mobile || bg.wideo_mp4} type="video/mp4" />
        </video>
      )}
    </>
  );
}