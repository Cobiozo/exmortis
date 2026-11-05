import React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { useSiteNav } from "@/components/exmortis/nav/useSiteNav";

// Grupy linków stopki (z panelu „Menu i stopka”, domyślnie FOOTER w navItems.js).
// Linki zewnętrzne: nowa karta + ikona ↗ + informacja dla czytników. Adres e-mail wyróżniony i zawijany.
const LINK = "inline-flex items-center gap-1.5 min-h-[40px] py-1 text-[15px] text-[#F5EFE1]/80 hover:text-[#C9A24A] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A24A]";

function FooterLink({ label, to }) {
  if (to.startsWith("/")) return <Link to={to} className={LINK}>{label}</Link>;
  if (to.startsWith("mailto:")) {
    return <a href={to} className={`${LINK} text-[#F5EFE1] break-all`}>{label}</a>;
  }
  const ext = to.startsWith("http");
  return (
    <a href={to} target={ext ? "_blank" : undefined} rel={ext ? "noopener noreferrer" : undefined} className={LINK}>
      {label}
      {ext && <><ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" /><span className="sr-only"> (otwiera się w nowej karcie)</span></>}
    </a>
  );
}

export default function FooterColumns() {
  const { kolumny } = useSiteNav();
  return (
    <div className="grid grid-cols-1 min-[360px]:grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-10">
      {kolumny.map((col, i) => (
        <nav key={i} aria-label={col.title} className={`min-w-0 ${i === 2 ? "min-[360px]:col-span-2 md:col-span-1" : ""}`}>
          <p className="technical text-[10px] gold-text mb-3">{String(col.title || "").toUpperCase()}</p>
          <ul className="space-y-1">
            {(col.links || []).map(({ label, to }, j) => (
              <li key={j}><FooterLink label={label} to={String(to || "")} /></li>
            ))}
          </ul>
        </nav>
      ))}
    </div>
  );
}
