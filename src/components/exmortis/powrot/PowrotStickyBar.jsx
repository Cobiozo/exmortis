import React, { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import BrandButton from "@/components/exmortis/ui/BrandButton";
import { useBottomBar } from "@/lib/bottomBar";
import { POWROT } from "@/lib/powrotOffer";

// Przyklejony pasek programu POWRÓT (19.11.2026) — jak pasek zakupu w sklepie: nazwa, najważniejsze fakty, cena
// i „Zgłoś się do programu”. Pojawia się, gdy pierwszy ekran (z przyciskami) zniknie u góry, chowa się, gdy na ekranie
// jest formularz zgłoszenia albo stopka. Podnosi „Nagłą pomoc” (--exm-bottom-bar) i respektuje safe-area telefonu.
function Bar() {
  const ref = useRef(null);
  useBottomBar(ref);
  const go = () => {
    const el = document.getElementById("formularz");
    if (!el) { window.location.hash = "formularz"; return; }
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };
  return (
    <div ref={ref} role="region" aria-label="Program POWRÓT — zgłoszenie"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-exm-line bg-exm-bg/95 px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur md:px-10">
      <div className="mx-auto flex w-full max-w-[var(--exm-container)] items-center gap-3 md:gap-6">
        <div className="min-w-0 flex-1">
          <p className="font-exm-serif text-[18px] leading-tight text-exm-ivory md:text-[20px]">Program POWRÓT</p>
          <p className="mt-0.5 truncate text-[13px] text-exm-gold">
            {POWROT.priceText}<span className="hidden text-exm-muted sm:inline"> · {POWROT.months} · {POWROT.sessions} sesji po {POWROT.lengthLong}</span>
          </p>
        </div>
        <BrandButton onClick={go} className="shrink-0">
          Zgłoś się do programu
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </BrandButton>
      </div>
    </div>
  );
}

export default function PowrotStickyBar() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let heroPassed = false, formSeen = false, footSeen = false;
    const sync = () => setShow(heroPassed && !formSeen && !footSeen);
    const obs = [];
    const watch = (el, fn) => { if (!el) return; const io = new IntersectionObserver(([e]) => { fn(e); sync(); }, { threshold: 0 }); io.observe(el); obs.push(io); };
    // Treść CMS dociąga się po chwili — czekamy na pierwszy blok i formularz.
    let tries = 0;
    const t = setInterval(() => {
      const hero = document.querySelector("main [data-block], [data-block]");
      const form = document.getElementById("formularz");
      if ((hero && form) || ++tries > 40) {
        clearInterval(t);
        watch(hero, (e) => { heroPassed = !e.isIntersecting && e.boundingClientRect.top < 0; });
        watch(form, (e) => { formSeen = e.isIntersecting; });
        watch(document.querySelector("footer"), (e) => { footSeen = e.isIntersecting; });
      }
    }, 250);
    return () => { clearInterval(t); obs.forEach((io) => io.disconnect()); };
  }, []);

  return show ? <Bar /> : null;
}
