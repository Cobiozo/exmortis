import { useEffect } from "react";

// Sterowanie z ekranu blokady, słuchawek i klawiszy multimedialnych (tam, gdzie przeglądarka to obsługuje).
// h — ref z aktualnymi funkcjami odtwarzacza, więc obsługa nie trzyma starego stanu.
export default function useMediaSession(ep, subtitle, h) {
  useEffect(() => {
    const ms = typeof navigator !== "undefined" ? navigator.mediaSession : null;
    if (!ms || !ep || !window.MediaMetadata) return undefined;
    try {
      ms.metadata = new window.MediaMetadata({
        title: ep.tytul || "", artist: subtitle, album: "Głos EXMORTIS",
        artwork: ep.okladka ? [{ src: ep.okladka, sizes: "512x512" }] : [],
      });
    } catch { /* bez metadanych */ }
    const map = {
      play: () => h.current.resume(), pause: () => h.current.pause(),
      seekbackward: () => h.current.skip(-15), seekforward: () => h.current.skip(30),
      seekto: (e) => h.current.seek(e.seekTime), previoustrack: () => h.current.prev(), nexttrack: () => h.current.next(),
    };
    for (const [k, fn] of Object.entries(map)) { try { ms.setActionHandler(k, fn); } catch { /* nieobsługiwane */ } }
    return () => { for (const k of Object.keys(map)) { try { ms.setActionHandler(k, null); } catch { /* */ } } };
  }, [ep?.id, ep?.audio]);
}