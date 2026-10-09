import React, { useState } from "react";
import { Loader2, CalendarClock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { smallBtn } from "./ui";

const pad = (n) => String(n).padStart(2, "0");
const local = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const plWhen = (d) => new Date(d).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", dateStyle: "long", timeStyle: "short" });

// Wybór daty i godziny publikacji (czas lokalny przeglądarki) albo anulowanie planu.
export default function ScheduleDialog({ open, onOpenChange, page, onSchedule, onCancel }) {
  const start = page.status === "zaplanowana" && page.publikacja ? new Date(page.publikacja) : new Date(Date.now() + 864e5);
  if (page.status !== "zaplanowana") start.setHours(20, 0, 0, 0);
  const [value, setValue] = useState(local(start));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const run = async (fn) => { setBusy(true); await fn(); setBusy(false); onOpenChange(false); };
  const save = () => {
    const d = new Date(value);
    if (isNaN(d) || d.getTime() < Date.now() + 60000) return setErr("Wybierz termin w przyszłości.");
    setErr(""); run(() => onSchedule(d.toISOString()));
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0A0A0B] border hairline max-w-md rounded-none">
        <DialogHeader><DialogTitle className="relic-heading text-2xl">Zaplanuj publikację</DialogTitle></DialogHeader>
        <p className="text-sm text-foreground/60">Obecny szkic zostanie opublikowany automatycznie o wybranej porze (z dokładnością do ok. 5 minut). Późniejsze zmiany w szkicu nie wejdą do tej publikacji.</p>
        <div className="relative">
          <input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)}
            className="dt-input w-full bg-[#0F0F10] border hairline px-4 py-3 pr-12" />
          <CalendarClock className="h-4 w-4 gold-text absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
        {err && <p className="text-sm blood-text">{err}</p>}
        <div className="flex flex-wrap gap-2 justify-end">
          {page.status === "zaplanowana" && <button className={smallBtn} disabled={busy} onClick={() => run(onCancel)}>Anuluj plan</button>}
          <button className="btn-relic !py-2.5 !px-5 disabled:opacity-50" disabled={busy} onClick={save}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Zaplanuj
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}