import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { dateTile, timeText, formatText, whenText } from "./time";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import RegistrationForm from "./RegistrationForm";
import { CoverTile } from "./cover";

const OUTLINE_GOLD =
  "inline-flex items-center justify-center gap-2 px-6 py-3 technical text-xs border border-[#C9A24A]/70 text-[#C9A24A] hover:bg-[#C9A24A]/10 hover:border-[#C9A24A] transition-all duration-300 w-full md:w-auto whitespace-nowrap";

// Kafelek wydarzenia: kwadrat daty, znaczkи, tytuł, przycisk akcji.
// Warianty: compact (strona główna), past (minione z nagraniem).
export default function EventTile({ event: ev, compact = false, past = false }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const d = dateTile(ev.start_datetime);
  const cancelled = ev.status === "Odwołane";
  const dimmed = cancelled || past;
  const free = !(Number(ev.price) > 0);
  const capacity = ev.capacity ? Number(ev.capacity) : 0;
  const registered = ev.registered || 0;
  const spotsLeft = capacity > 0 ? capacity - registered : null;
  const full = capacity > 0 && spotsLeft <= 0;
  const external = ev.registration_type === "Link zewnętrzny" && ev.external_url;
  const onSite = ev.registration_type === "Zapis na stronie";
  const minutes = Number(ev.duration_minutes) || 60;

  const stop = (e) => e.stopPropagation();
  const openModal = (e) => {
    stop(e);
    setOpen(true);
  };

  const action = () => {
    if (cancelled) {
      return <span className="technical text-[10px] text-foreground/50 py-3 block text-center md:text-right">Odwołane</span>;
    }
    if (past) {
      return (
        <a href={ev.recording_url} target="_blank" rel="noreferrer" onClick={stop} className={OUTLINE_GOLD}>
          OBEJRZYJ NAGRANIE
        </a>
      );
    }
    if (external) {
      return (
        <a href={ev.external_url} target="_blank" rel="noreferrer" onClick={stop} className={OUTLINE_GOLD}>
          DOŁĄCZ DO TRANSMISJI
        </a>
      );
    }
    if (onSite && !free && !full) {
      return (
        <Link to={`/spotkania/${ev.slug}#zapis`} onClick={stop} className={OUTLINE_GOLD}>
          ZAPISZ SIĘ
        </Link>
      );
    }
    if (onSite) {
      return (
        <button
          type="button"
          onClick={openModal}
          className={
            free
              ? "btn-relic !px-6 !py-3 w-full md:w-auto whitespace-nowrap"
              : OUTLINE_GOLD
          }
        >
          {full ? "LISTA REZERWOWA" : "ZAPISZ SIĘ"}
        </button>
      );
    }
    return null;
  };

  const spotsNote =
    !cancelled && !past && spotsLeft !== null && spotsLeft > 0 && spotsLeft < capacity * 0.3;

  const badges = (
    <div className="flex flex-wrap gap-2">
      <span className="technical text-[8px] text-foreground/60 border border-[#2A2A2A] px-2 py-1">
        {ev.event_type.toUpperCase()}
      </span>
      {free ? (
        <span className="technical text-[8px] gold-text border border-[#C9A24A]/50 px-2 py-1">BEZPŁATNE</span>
      ) : (
        <span className="technical text-[8px] blood-text border border-[#BC1E22]/50 px-2 py-1">
          PŁATNE · {Number(ev.price)} ZŁ
        </span>
      )}
    </div>
  );

  const titleCls = `shop-heading ${compact ? "text-lg md:text-xl" : "text-xl md:text-2xl"} text-[#F5EFE1] leading-snug [text-wrap:balance] break-words`;
  const infoLine = `${timeText(ev.start_datetime)} · ${minutes} min · ${formatText(ev.format)}`.toUpperCase();

  return (
    <>
      <article
        onClick={() => navigate(`/spotkania/${ev.slug}`)}
        className={`group cursor-pointer border border-[#2A2A2A] bg-[#121212] transition-colors duration-300 hover:border-[#C9A24A] flex flex-col h-full min-w-0 ${
          past ? "opacity-50" : ""
        }`}
      >
        <CoverTile ev={ev} />
        <div className={`flex flex-col gap-4 flex-1 ${cancelled ? "opacity-60" : ""} ${compact ? "p-4 md:p-5" : "p-5 md:p-6"}`}>
          <div className="flex gap-4 items-start">
            {/* kwadrat daty */}
            <div
              className="flex-shrink-0 border border-[#C9A24A] flex flex-col items-center justify-between py-1.5 w-[72px] h-[72px]"
            >
              <span className="technical text-[8px] text-foreground/60">{d.month}</span>
              <span className="font-heading gold-text leading-none text-2xl">
                {d.day}
              </span>
              <span className="text-[10px] text-foreground/50">{d.weekday}</span>
            </div>

            {/* znaczkи + nazwa */}
            <div className="min-w-0">
              {badges}
              <h3 className={`${titleCls} mt-2`}>{ev.title}</h3>
            </div>
          </div>

          <div>
            {ev.subtitle && <p className="italic text-foreground/50 text-sm leading-relaxed">{ev.subtitle}</p>}
            <p className="technical text-[9px] text-foreground/40 mt-2">{infoLine}</p>
          </div>

          {/* przycisk zawsze na dole karty */}
          <div className="mt-auto w-full flex flex-col gap-2 [&>a]:w-full [&>button]:w-full">
            {action()}
            {spotsNote && (
              <p className="technical text-[9px] text-foreground/50 text-center md:text-right">
                zostało {spotsLeft} {spotsLeft === 1 ? "miejsce" : spotsLeft < 5 ? "miejsca" : "miejsc"}
              </p>
            )}
          </div>
        </div>
      </article>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#121212] border-[#2A2A2A] max-w-md">
          <DialogHeader>
            <DialogTitle className="shop-heading text-xl text-[#F5EFE1]">{ev.title}</DialogTitle>
            <DialogDescription className="text-foreground/50">
              {whenText(ev.start_datetime)} · {formatText(ev.format)}
            </DialogDescription>
          </DialogHeader>
          <RegistrationForm event={ev} />
        </DialogContent>
      </Dialog>
    </>
  );
}