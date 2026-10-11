import React, { useEffect, useRef, useState } from "react";

// Natywny odtwarzacz. Podpisany link wygasa, więc odnawiamy go tuż przed końcem ważności
// i po błędzie odtwarzania — pozycja słuchania zostaje zachowana.
export default function AudioPlayer({ src, expiresIn, onRefresh }) {
  const ref = useRef(null);
  const pos = useRef(0);
  const [url, setUrl] = useState(src);

  useEffect(() => { setUrl(src); pos.current = 0; }, [src]);

  const renew = async () => {
    const a = ref.current;
    if (a) pos.current = a.currentTime || 0;
    const next = await onRefresh().catch(() => null);
    if (next) setUrl(next);
    else if (a) a.currentTime = pos.current;
  };

  // Odświeżenie na 2 minuty przed wygaśnięciem linku.
  useEffect(() => {
    if (!expiresIn || !url) return;
    const t = setTimeout(renew, Math.max(60, Number(expiresIn) - 120) * 1000);
    return () => clearTimeout(t);
  }, [url, expiresIn]);

  // Po podmianie źródła wracamy na zapamiętaną pozycję.
  useEffect(() => {
    const a = ref.current;
    if (a && pos.current > 0) { try { a.currentTime = pos.current; } catch { /* brak metadanych */ } }
  }, [url]);

  return (
    <audio
      ref={ref}
      src={url}
      controls
      preload="metadata"
      onError={renew}
      className="w-full min-h-[44px]"
    />
  );
}