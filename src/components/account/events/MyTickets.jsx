import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Ticket } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { plWhenFull } from "@/components/exmortis/events/time";

// Moje konto → Spotkania: bilety kupione tym adresem (PDF i bilet na telefonie).
export default function MyTickets() {
  const [list, setList] = useState(null);
  useEffect(() => {
    base44.functions.invoke("tickets", { action: "mine" }).then((r) => setList(r.data.tickets || [])).catch(() => setList([]));
  }, []);
  if (!list || !list.length) return null;
  return (
    <section>
      <p className="technical text-[10px] gold-text mb-6">MOJE BILETY</p>
      <ul className="divide-y hairline border-y hairline">
        {list.map((t) => (
          <li key={t.code} className="py-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <Ticket className="h-4 w-4 gold-text shrink-0" aria-hidden="true" />
            <div className="flex-1 min-w-[12rem]">
              <p className="text-[#F5EFE1]">{t.title}</p>
              <p className="text-foreground/55 text-xs mt-1">{t.start_datetime ? plWhenFull(t.start_datetime) : ""} · {t.holder_name}</p>
            </div>
            <span className="font-mono gold-text">{t.code}</span>
            {t.status === "wykorzystany" && <span className="technical text-[9px] text-foreground/45">WYKORZYSTANY</span>}
            <Link to={t.link} className="technical text-[10px] gold-text">OTWÓRZ</Link>
            <a href={t.pdf} className="technical text-[10px] gold-text inline-flex items-center gap-1"><Download className="h-3.5 w-3.5" /> PDF</a>
          </li>
        ))}
      </ul>
    </section>
  );
}
