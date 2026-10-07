import React from "react";
import { CalendarPlus, FileDown } from "lucide-react";

import { googleCalendarUrl, downloadIcs } from "./time";

// Dodaj do kalendarza: Google Calendar i plik .ics (Apple / Outlook).
export default function CalendarButtons({ event }) {
  if (!event.start_datetime) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 [&>*]:w-full sm:[&>*]:w-auto">
      <a
        href={googleCalendarUrl(event)}
        target="_blank"
        rel="noreferrer"
        className="btn-ghost !px-5 !py-3"
      >
        <CalendarPlus className="h-4 w-4" /> GOOGLE CALENDAR
      </a>
      <button onClick={() => downloadIcs(event)} className="btn-ghost !px-5 !py-3">
        <FileDown className="h-4 w-4" /> PLIK .ICS (APPLE / OUTLOOK)
      </button>
    </div>
  );
}