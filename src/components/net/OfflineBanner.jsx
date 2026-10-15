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
      className="fixed top-0 inset-x-0 z-[100] pt-[max(8px,env(safe-area-inset-top))] pb-2 bg-[#6B4E00] text-white text-sm px-4 text-center">
      Brak połączenia z internetem — to, co teraz wyślesz, może się nie zapisać.
    </div>
  );
}
