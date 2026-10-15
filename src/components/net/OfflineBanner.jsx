import React, { useEffect, useState } from "react";

// Pasek „brak połączenia”: widoczny tylko offline, znika sam po powrocie sieci.
// Nie blokuje strony — ROZDROŻA i Minutnik działają offline z zapisanej kopii.
export default function OfflineBanner() {
  const [off, setOff] = useState(() => typeof navigator !== "undefined" && navigator.onLine === false);
  useEffect(() => {
    const on = () => setOff(false);
    const down = () => setOff(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", down); };
  }, []);
  if (!off) return null;
  return (
    <div role="status" aria-live="polite"
      className="fixed bottom-[max(12px,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-[100] max-w-[calc(100vw-32px)] bg-[#6B4E00] text-white text-sm px-4 py-2 shadow-lg text-center">
      Brak połączenia z internetem — to, co teraz wyślesz, może się nie zapisać.
    </div>
  );
}
