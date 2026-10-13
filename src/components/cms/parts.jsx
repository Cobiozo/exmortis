import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { nbsp } from "@/lib/nbsp";

const STY = { zloty: "btn-relic", obrys: "btn-ghost", tekst: "inline-flex items-center gap-2 technical text-xs gold-text hover:text-[#E2C170]" };

export function CmsButton({ b }) {
  const cls = STY[b.styl] || STY.zloty;
  const inner = <>{b.etykieta}{b.strzalka && <ArrowRight className="h-4 w-4" />}</>;
  const link = b.link || "/";
  const tab = b.nowa_karta ? { target: "_blank", rel: "noopener noreferrer" } : {};
  if (/^(https:|mailto:|tel:|#)/i.test(link)) return <a href={link} className={cls} {...tab}>{inner}</a>;
  return <Link to={link} className={cls} {...tab}>{inner}</Link>;
}

// pion = przyciski jeden pod drugim (na komputerze o równej szerokości, na telefonie na całą szerokość).
export function Buttons({ list, className = "", pion = false }) {
  if (!list?.length) return null;
  const lay = pion ? "flex sm:inline-flex flex-col gap-3" : "flex flex-col sm:flex-row flex-wrap gap-4";
  return <div className={`${lay} ${className}`}>{list.map((b, i) => <CmsButton key={i} b={b} />)}</div>;
}

export function Rich({ html, className = "" }) {
  return <div className={`rich-content ${className}`} dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />;
}

export const Lines = ({ text }) => String(text || "").split("\n").map((l, i, a) => <React.Fragment key={i}>{l}{i < a.length - 1 && <br />}</React.Fragment>);

// Nagłówek sekcji: etykieta + tytuł, opcjonalnie wstęp po prawej (układ 4/8).
export function SectionHead({ label, title, intro, introHtml, center }) {
  if (!label && !title && !intro && !introHtml) return null;
  const head = (
    <>
      {label && <p className="technical text-[11px] gold-text mb-4">{label}</p>}
      {title && <h2 className="relic-heading text-4xl md:text-5xl lg:text-6xl leading-[0.95] [overflow-wrap:break-word]"><Lines text={nbsp(title)} /></h2>}
    </>
  );
  if (center || (!intro && !introHtml)) return <div className="mb-12 md:mb-16">{head}</div>;
  return (
    <div className="grid lg:grid-cols-12 gap-6 lg:gap-10 mb-16">
      <div className="lg:col-span-5 min-w-0">{head}</div>
      <div className="lg:col-span-7 flex items-end">
        {introHtml ? <Rich html={introHtml} className="text-foreground/60 text-lg leading-relaxed max-w-xl" />
          : <p className="text-foreground/60 text-lg leading-relaxed max-w-xl">{intro}</p>}
      </div>
    </div>
  );
}