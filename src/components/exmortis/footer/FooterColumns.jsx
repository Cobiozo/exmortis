import React from "react";
import { Link } from "react-router-dom";
import { useSiteNav } from "@/components/exmortis/nav/useSiteNav";

const cls = "text-foreground/70 hover:gold-text transition-colors";

export default function FooterColumns() {
  const { kolumny } = useSiteNav();
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-10">
      {kolumny.map((col, i) => (
        <nav key={i} aria-label={col.title}>
          <p className="technical text-[10px] gold-text mb-5">{col.title}</p>
          <ul className="space-y-3 text-sm">
            {(col.links || []).map(({ label, to }, j) => (
              <li key={j}>
                {to.startsWith("/") ? <Link to={to} className={cls}>{label}</Link>
                  : <a href={to} target={to.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className={cls}>{label}</a>}
              </li>
            ))}
          </ul>
        </nav>
      ))}
    </div>
  );
}