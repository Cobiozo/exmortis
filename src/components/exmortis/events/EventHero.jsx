import React from "react";
import BrandButton from "@/components/exmortis/ui/BrandButton";
import ImageFallback from "@/components/exmortis/ui/ImageFallback";
import EventFacts from "./EventFacts";
import { coverOf } from "./cover";
import { formatText } from "./time";

// Pierwszy ekran spotkania: obraz 16:9 (bez okładki — sygnet marki), etykieta formy, tytuł,
// temat, siatka faktów i jeden główny przycisk. Zapis prowadzi do obecnego formularza na stronie.
function goToForm() {
  const el = document.getElementById("zapis");
  if (!el) return;
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
  // Fokus na pierwszym polu formularza — klawiatura i czytnik ekranu zaczynają od zapisu.
  window.setTimeout(() => {
    el.querySelector("input:not([type=checkbox]), textarea, button, a")?.focus({ preventScroll: true });
  }, calm ? 0 : 420);
}

function Cta({ ev, landing, ended }) {
  if (ev.status === "Odwołane") {
    return <p className="mt-7 text-[15px] leading-relaxed text-exm-muted">To spotkanie zostało odwołane.</p>;
  }
  if (ended) {
    return (
      <div className="mt-7">
        <BrandButton to="/spotkania" variant="secondary">Zobacz kolejne terminy</BrandButton>
      </div>
    );
  }
  if (landing) {
    return <div className="mt-7"><BrandButton to={landing}>Zapisz się</BrandButton></div>;
  }
  if (ev.registration_type === "Link zewnętrzny" && ev.external_url) {
    return <div className="mt-7"><BrandButton href={ev.external_url}>Dołącz do transmisji</BrandButton></div>;
  }
  if (ev.registration_type === "Bez zapisu") {
    return <p className="mt-7 text-[15px] leading-relaxed text-exm-muted">Nie trzeba się zapisywać — wystarczy przyjść.</p>;
  }
  return <div className="mt-7"><BrandButton onClick={goToForm}>Zapisz się</BrandButton></div>;
}

export default function EventHero({ ev, landing, ended }) {
  const cover = coverOf(ev);
  const cancelled = ev.status === "Odwołane";

  return (
    <div className="min-w-0">
      <div className="relative aspect-[16/9] overflow-hidden rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface-2">
        {cover ? (
          <img
            src={cover.crops?.wide || cover.src}
            alt={cover.alt || ev.title || "Spotkanie exmortis"}
            width={1600}
            height={900}
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: `${(cover.fx ?? 0.5) * 100}% ${(cover.fy ?? 0.5) * 100}%` }}
          />
        ) : (
          <ImageFallback label={ev.title || "Spotkanie exmortis"} className="h-full w-full" />
        )}
        {cancelled && (
          <span className="technical absolute left-3 top-3 rounded-exm-pill border border-exm-line bg-exm-bg/85 px-2.5 py-1 text-[10px] text-exm-text">
            Odwołane
          </span>
        )}
      </div>

      <p className="exm-eyebrow mt-7">
        {String(ev.event_type || "Spotkanie")}
        {ev.format ? ` · ${formatText(ev.format)}` : ""}
      </p>
      <h1 className="exm-h1 mt-3 break-words">{ev.title}</h1>
      {ev.subtitle && <p className="exm-lead mt-4">{ev.subtitle}</p>}

      <div className="mt-8">
        <EventFacts ev={ev} />
      </div>

      <Cta ev={ev} landing={landing} ended={ended} />
    </div>
  );
}