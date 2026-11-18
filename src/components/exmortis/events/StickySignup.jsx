import React, { useEffect, useRef, useState } from "react";
import { useBottomBar } from "@/lib/bottomBar";
import { dateParts, timeText } from "./time";

// Telefon: przyklejony pasek „data · cena · Zapisz się". Wzorem paska zakupu w Skarbcu pojawia się,
// gdy blok zapisu zostanie przewinięty w górę, i chowa się przy końcu strony. Podnosi przycisk
// „Nagła pomoc" (zmienna --exm-bottom-bar ustawiana hookiem w komponencie widocznego paska).
const priceOf = (ev) => (Number(ev?.price) > 0 ? `${Number(ev.price)} zł` : "Bezpłatne");

function Bar({ targetId, label, event }) {
  const ref = useRef(null);
  useBottomBar(ref);
  const d = event?.start_datetime ? dateParts(event.start_datetime) : null;
  const when = d ? `${d.day} ${d.month} · ${timeText(event.start_datetime)}` : null;

  return (
    <div
      ref={ref}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-exm-line bg-exm-bg/95 px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur lg:hidden"
    >
      <div className="flex items-center gap-3">
        {event && (
          <div className="min-w-0 flex-1">
            {when && <p className="truncate text-[13px] leading-tight text-exm-text">{when}</p>}
            <p className="text-[13px] leading-tight text-exm-muted">{priceOf(event)}</p>
          </div>
        )}
        <a href={`#${targetId}`} className={event ? "btn-relic shrink-0" : "btn-relic w-full"}>{label}</a>
      </div>
    </div>
  );
}

export default function StickySignup({ targetId = "zapis", label = "Zapisz się", event = null, endId = null }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const form = document.getElementById(targetId);
    if (!form) return undefined;
    const end = endId ? document.getElementById(endId) : null;
    let passed = false; // blok zapisu jest nad ekranem
    let endSeen = false; // doszliśmy do końca treści
    const sync = () => setShow(passed && !endSeen);
    const ioForm = new IntersectionObserver(([e]) => {
      passed = !e.isIntersecting && e.boundingClientRect.top < 0;
      sync();
    }, { threshold: 0 });
    const ioEnd = end ? new IntersectionObserver(([e]) => { endSeen = e.isIntersecting; sync(); }, { threshold: 0 }) : null;
    ioForm.observe(form);
    ioEnd?.observe(end);
    return () => { ioForm.disconnect(); ioEnd?.disconnect(); };
  }, [targetId, endId]);

  return show ? <Bar targetId={targetId} label={label} event={event} /> : null;
}