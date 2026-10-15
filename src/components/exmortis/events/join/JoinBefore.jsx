import React, { useEffect, useState } from "react";
import { CalendarPlus, Lock } from "lucide-react";
import useOnlineText from "@/content/useOnlineText";
import { downloadIcs, timeText } from "../time";

const unit = (n, a, b, c) => `${n} ${n === 1 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c}`;

// Odliczanie do startu (dni, godziny, minuty); przy otwarciu pokoju — onOpen().
export default function JoinBefore({ data, onOpen }) {
  const t = useOnlineText();
  const start = new Date(data.start_datetime).getTime();
  const openAt = start - data.open_minutes * 60000;
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(i); }, []);
  useEffect(() => { if (now >= openAt) onOpen(); }, [now, openAt, onOpen]);
  const m = Math.max(0, Math.ceil((start - now) / 60000));
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  return (
    <>
      <p className="digits font-mono text-2xl sm:text-3xl text-[#F5EFE1] mt-8" role="timer">
        {[d && unit(d, "dzień", "dni", "dni"), (d || h) && unit(h, "godzina", "godziny", "godzin"), unit(mm, "minuta", "minuty", "minut")].filter(Boolean).join(" · ")}
      </p>
      <p className="text-foreground/70 mt-6 leading-relaxed">{t("przed", { minuty: data.open_minutes, otwarcie: timeText(new Date(openAt).toISOString()) })}</p>
      {/* Przycisk wejścia widoczny od razu, nieaktywny do otwarcia pokoju — o tej godzinie strona sama podmienia go na działający. */}
      <div className="mt-8 flex flex-wrap gap-3">
        <button type="button" disabled aria-disabled="true" className="btn-relic opacity-45 cursor-not-allowed">
          <Lock className="h-4 w-4" /> DOŁĄCZ — AKTYWNY OD {timeText(new Date(openAt).toISOString())}
        </button>
        <button type="button" onClick={() => downloadIcs(data)} className="btn-ghost"><CalendarPlus className="h-4 w-4" /> DODAJ DO KALENDARZA</button>
      </div>
    </>
  );
}