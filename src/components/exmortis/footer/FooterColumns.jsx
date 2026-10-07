import React from "react";
import { Link } from "react-router-dom";

const COLUMNS = [
  { title: "Skarbiec", links: [
    ["Wszystkie produkty", "/sklep?src=footer"],
    ["Spotkania", "/spotkania?src=footer"],
    ["Powrót — mentoring", "/powrot"],
    ["Moje konto", "/konto"],
  ] },
  { title: "Słuchaj", links: [
    ["Podcast „Głos”", "/glos?src=footer"],
    ["Chwila ciszy", "/cisza?src=footer"],
    ["Test: która śmierć jest Twoja?", "/test?src=footer"],
  ] },
  { title: "Poznaj", links: [
    ["Strona główna", "/"],
    ["O mnie", "/o-mnie"],
    ["Manifest", "/#manifest"],
    ["Formularz kontaktowy", "/#kontakt"],
  ] },
  { title: "Kontakt", links: [
    ["kontakt@exmortis.pl", "mailto:kontakt@exmortis.pl"],
    ["Instagram", "https://www.instagram.com/e.x.m.o.r.t.i.s/"],
    ["Facebook", "https://www.facebook.com/dawidkowalczyk.exmortis"],
    ["YouTube", "https://www.youtube.com/@e.x.m.o.r.t.i.s"],
  ] },
];

const cls = "text-foreground/70 hover:gold-text transition-colors";

export default function FooterColumns() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-10">
      {COLUMNS.map((col) => (
        <nav key={col.title} aria-label={col.title}>
          <p className="technical text-[10px] gold-text mb-5">{col.title}</p>
          <ul className="space-y-3 text-sm">
            {col.links.map(([label, to]) => (
              <li key={label}>
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