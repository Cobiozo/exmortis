import React, { useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import EventTile from "@/components/exmortis/events/EventTile";
import { CoverHero } from "@/components/exmortis/events/cover";
import HeroContent from "@/components/exmortis/events/HeroContent";
import { toPayload } from "./eventForm";

// Podgląd na żywo: kafelek listy + nagłówek strony spotkania, przełącznik telefon / komputer.
export default function EventPreview({ form }) {
  const [mode, setMode] = useState("phone");
  const ev = { ...toPayload(form, form.status), id: form.id || "podglad", slug: form.slug || "podglad", registered: 0 };
  if (!ev.start_datetime) ev.start_datetime = new Date(Date.now() + 864e5).toISOString();
  const phone = mode === "phone";
  const btn = (m, Icon, l) => (
    <button type="button" onClick={() => setMode(m)} aria-pressed={mode === m}
      className={`min-h-[40px] px-3 inline-flex items-center gap-2 text-xs border ${mode === m ? "border-[#C9A24A] gold-text" : "hairline text-foreground/50"}`}><Icon className="h-4 w-4" />{l}</button>
  );
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="technical text-[10px] text-foreground/50">PODGLĄD NA ŻYWO</p>
        <div className="flex gap-1">{btn("phone", Smartphone, "Telefon")}{btn("desktop", Monitor, "Komputer")}</div>
      </div>
      <div className={`mx-auto pointer-events-none border hairline bg-[#0A0A0B] overflow-hidden ${phone ? "max-w-[320px]" : "w-full"}`} aria-hidden="true">
        <CoverHero ev={ev} forceTall={phone}><HeroContent ev={ev} small /></CoverHero>
      </div>
      <div className={`mx-auto pointer-events-none ${phone ? "max-w-[320px]" : "max-w-[380px]"}`} aria-hidden="true">
        <EventTile event={ev} />
      </div>
    </div>
  );
}