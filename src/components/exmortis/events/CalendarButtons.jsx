import React from "react";
import { CalendarPlus } from "lucide-react";

import { googleCalendarUrl, outlookCalendarUrl, icsUrl } from "./time";

// Dodaj do kalendarza jednym kliknięciem: Google, Outlook albo Apple / inny (plik .ics otwierany od razu).
// joinUrl i t — osobisty link dołączenia po zapisie (trafia do opisu wydarzenia w kalendarzu).
export default function CalendarButtons({ event, joinUrl = null, t = null, className = "" }) {
  if (!event?.start_datetime) return null;
  const btn = "btn-ghost w-full justify-center";
  return (
    <div className={className}>
      <p className="exm-eyebrow mb-3 flex items-center gap-2">
        <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" /> Dodaj do kalendarza
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <a href={googleCalendarUrl(event, joinUrl)} target="_blank" rel="noopener noreferrer" className={btn}>Google</a>
        <a href={outlookCalendarUrl(event, joinUrl)} target="_blank" rel="noopener noreferrer" className={btn}>Outlook</a>
        <a href={icsUrl(event, t)} className={btn}>Apple / inny</a>
      </div>
    </div>
  );
}