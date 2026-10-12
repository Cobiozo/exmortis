import React, { useEffect, useRef, useState } from "react";

// Natywny odtwarzacz dla własnych plików wideo (wgranych do aplikacji albo z serwera Dawida).
// Plik z aplikacji ma podpisany link — odnawiamy go przed wygaśnięciem i po błędzie, z zachowaniem pozycji.
// Gdy pobieranie jest wyłączone: bez przycisku pobierania i bez menu kontekstowego (to utrudnienie, nie blokada).
export default function VideoPlayer({ src, expiresIn, onRefresh, allowDownload, title }) {
  const ref = useRef(null);
  const pos = useRef(0);
  const [url, setUrl] = useState(src);
  const [failed, setFailed] = useState(false);

  useEffect(() => { setUrl(src); pos.current = 0; setFailed(false); }, [src]);

  const renew = async () => {
    const v = ref.current;
    if (v) pos.current = v.currentTime || 0;
    if (!onRefresh) { setFailed(true); return; }
    const next = await onRefresh().catch(() => null);
    if (next && next !== url) setUrl(next);
    else setFailed(true);
  };

  useEffect(() => {
    if (!expiresIn || !url || !onRefresh) return;
    const t = setTimeout(renew, Math.max(60, Number(expiresIn) - 120) * 1000);
    return () => clearTimeout(t);
  }, [url, expiresIn]);

  useEffect(() => {
    const v = ref.current;
    if (v && pos.current > 0) { try { v.currentTime = pos.current; } catch { /* brak metadanych */ } }
  }, [url]);

  if (failed) {
    return <p className="font-body text-[15px] text-[#F5EFE1]/70">Film jest chwilowo niedostępny. Spróbuj ponownie za chwilę.</p>;
  }

  return (
    <video
      ref={ref}
      src={url}
      title={title}
      controls
      playsInline
      preload="metadata"
      controlsList={allowDownload ? undefined : "nodownload"}
      onContextMenu={allowDownload ? undefined : (e) => e.preventDefault()}
      onError={renew}
      className="w-full max-h-[70vh] bg-black"
    />
  );
}
