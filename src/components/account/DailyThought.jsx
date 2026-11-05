import React, { useEffect, useState } from "react";
import { useSiteContent } from "@/components/exmortis/SiteContentProvider";
import { useAdminMode } from "@/components/admin/AdminModeContext";
import { DEF_LIST, DEF_SPECIAL, DEF_TEXTS, pickThought, partOfDay, isoDay } from "@/content/thoughts";

const fmt = new Intl.DateTimeFormat("pl-PL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

// Pasek „Myśl na dziś” pod powitaniem w koncie. Admin może podejrzeć porę: /konto?godzina=2
export default function DailyThought() {
  const { list, str } = useSiteContent();
  const { isAdmin } = useAdminMode();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 300000); return () => clearInterval(t); }, []);

  const sim = new URLSearchParams(window.location.search).get("godzina");
  const hour = isAdmin && sim !== null && !isNaN(+sim) ? +sim : now.getHours();
  const pod = partOfDay(hour);
  const thought = pickThought(now, list("mysli", "lista", DEF_LIST), list("mysli", "specjalne", DEF_SPECIAL));
  const txt = (k) => str("mysli", k, DEF_TEXTS[k]) || "";

  const dateLabel = fmt.format(now).replace(/^(\S+?),? /, "$1, ");

  // Pasek pod powitaniem: etykieta z datą i myśl; rano dodatkowa linijka z panelu. Nocny dopisek, numer
  // i przycisk Biblioteki usunięte 5.11.2026 (decyzja właściciela: Biblioteka jest w menu konta,
  // numery pomocowe są w stopce i w panelu „Nagła pomoc”).
  return (
    <section aria-label="Myśl na dziś" className="border-y hairline py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="technical text-[10px] gold-text">
          MYŚL NA DZIŚ <span className="text-[#F5EFE1]/70">· <time dateTime={isoDay(now)}>{dateLabel.toUpperCase()}</time></span>
        </p>
        {thought && <p className="shop-heading italic text-xl md:text-2xl leading-snug text-[#F5EFE1] mt-2 no-hyph break-words">{thought}</p>}
        {pod === "rano" && txt("rano") && <p className="text-sm text-[#F5EFE1]/75 mt-2">{txt("rano")}</p>}
      </div>
    </section>
  );
}
