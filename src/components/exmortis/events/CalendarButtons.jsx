import React from "react";
import { CalendarPlus } from "lucide-react";

import { googleCalendarUrl, outlookCalendarUrl, icsUrl } from "./time";

// Dodaj do kalendarza jednym kliknięciem: Google, Outlook albo Apple / inny (plik .ics otwierany od razu).
// joinUrl i t — osobisty link dołączenia po zapisie (trafia do opisu wydarzenia w kalendarzu).
export default function CalendarButtons({ event, joinUrl = null, t = null, className = "" }) {
  if (!event?.start_datetime) return null;
  const btn = "btn-ghost !px-4 !py-3 justify-center";
  return (
    <div className={className}>
      <p className="technical text-[10px] text-foreground/55 mb-3 flex items-center gap-2">
        <CalendarPlus className="h-3.5 w-3.5" /> DODAJ DO KALENDARZA
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <a href={googleCalendarUrl(event, joinUrl)} target="_blank" rel="noopener noreferrer" className={btn}>GOOGLE</a>
        <a href={outlookCalendarUrl(event, joinUrl)} target="_blank" rel="noopener noreferrer" className={btn}>OUTLOOK</a>
        <a href={icsUrl(event, t)} className={btn}>APPLE / INNY</a>
      </div>
    </div>
  );
}
