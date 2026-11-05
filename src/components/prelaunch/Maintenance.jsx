import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import Logo from "@/components/exmortis/Logo";
import useSystemText from "@/content/useSystemText";
import usePrelaunch, { hasEnd } from "@/lib/usePrelaunch";
import { useAdminMode } from "@/components/admin/AdminModeContext";

const fmt = (d) => new Date(d).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
const LEGAL = [["/regulamin", "Regulamin"], ["/polityka-prywatnosci", "Polityka prywatności"], ["/polityka-cookies", "Polityka cookies"], ["/odstapienie", "Odstąpienie od umowy"]];

// Strona przerwy technicznej dla gości. Teksty: Panel → Treści → Teksty systemowe („Przerwa techniczna — …”).
export default function Maintenance() {
  const t = useSystemText();
  const { until } = usePrelaunch();
  const { isAdmin } = useAdminMode();
  useEffect(() => {
    const prev = document.title;
    document.title = "exmortis — przerwa techniczna";
    let robots = document.querySelector('meta[name="robots"]');
    const had = robots?.getAttribute("content");
    if (!robots) { robots = document.createElement("meta"); robots.setAttribute("name", "robots"); document.head.appendChild(robots); }
    robots.setAttribute("content", "noindex");
    return () => { document.title = prev; if (had == null) robots.remove(); else robots.setAttribute("content", had); };
  }, []);
  return (
    <main className={`min-h-[100svh] bg-[#0A0A0B] flex flex-col items-center justify-center px-6 ${isAdmin ? "pt-24" : "pt-16"} pb-16 text-center`}>
      <Logo className="h-16 w-16 md:h-20 md:w-20 mb-10" />
      <p className="technical text-[11px] gold-text mb-5">{t("pt.etykieta")}</p>
      <h1 className="relic-heading text-3xl md:text-5xl max-w-2xl leading-tight">{t("pt.tytul")}</h1>
      <p className="text-foreground/70 text-lg leading-relaxed max-w-xl mt-6">{t("pt.tekst")}</p>
      {hasEnd(until) && <p className="gold-text mt-5">{t("pt.koniec", { kiedy: fmt(until) })}</p>}
      <div className="flex flex-wrap items-center justify-center gap-3 mt-10">
        <Link to="/login" className="btn-relic">{t("pt.zaloguj")}</Link>
        <Link to="/kontakt" className="btn-ghost">{t("pt.kontakt")}</Link>
      </div>
      <nav aria-label="Dokumenty" className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-14">
        {LEGAL.map(([to, label]) => (
          <Link key={to} to={to} className="min-h-[44px] inline-flex items-center text-sm text-[#F5EFE1]/60 hover:text-[#C9A24A]">{label}</Link>
        ))}
      </nav>
    </main>
  );
}
