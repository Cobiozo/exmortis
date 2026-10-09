import React, { useEffect, useState } from "react";
import { useSiteContent } from "@/components/exmortis/SiteContentProvider";
import { useAdminMode } from "@/components/admin/AdminModeContext";
import { DEF_LIST, DEF_SPECIAL, DEF_TEXTS, pickThought, partOfDay, isoDay } from "@/content/thoughts";

const fmt = new Intl.DateTimeFormat("pl-PL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const LINK = "underline decoration-[#C9A24A] underline-offset-4 hover:text-[#C9A24A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A24A]";

// Blok „Myśl na dziś” w nagłówku konta. Admin może podejrzeć porę: /konto?godzina=2
export default function DailyThought({ hasObok, onObok }) {
  const { list, str } = useSiteContent();
  const { isAdmin } = useAdminMode();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 300000); return () => clearInterval(t); }, []);

  const sim = new URLSearchParams(window.location.search).get("godzina");
  const hour = isAdmin && sim !== null && !isNaN(+sim) ? +sim : now.getHours();
  const pod = partOfDay(hour);
  const thought = pickThought(now, list("mysli", "lista", DEF_LIST), list("mysli", "specjalne", DEF_SPECIAL));
  const txt = (k) => str("mysli", k, DEF_TEXTS[k]) || "";
  const [before, after] = txt("noc").split("{Obok}");
  const date = fmt.format(now).replace(/^(\S+?),? /, "$1 · ").toUpperCase();

  return (
    <aside className="w-full lg:max-w-[380px] lg:text-right min-h-[150px]" aria-label="Myśl na dziś">
      <p className="font-mono text-xs tracking-[0.18em] text-[#C9A24A]">MYŚL NA DZIŚ</p>
      <time dateTime={isoDay(now)} className="block font-mono text-[13px] text-[#F5EFE1]/70 mt-2">{date}</time>
      {pod === "rano" && txt("rano") && <p className="shop-heading text-base text-[#F5EFE1]/70 mt-2">{txt("rano")}</p>}
      {pod === "noc" && (
        <div className="mt-2 space-y-1">
          {hasObok && <p className="shop-heading text-base text-[#F5EFE1]/70">{before}<button type="button" onClick={onObok} className={LINK}>Obok</button>{after}</p>}
          <p className="text-sm text-[#F5EFE1]/70"><a href="tel:116123" className={LINK}>{txt("tel")}</a></p>
        </div>
      )}
      <div className="h-px w-10 bg-[#C9A24A] my-4 lg:ml-auto" />
      {thought && <p className="shop-heading italic text-lg md:text-xl leading-[1.4] text-[#F5EFE1] no-hyph">{thought}</p>}
    </aside>
  );
}