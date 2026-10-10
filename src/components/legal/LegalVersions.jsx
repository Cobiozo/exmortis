import React from "react";
import { Link, useLocation } from "react-router-dom";
import { plDate } from "@/lib/legalFill";

// Wersja + „Poprzednie wersje” (archiwum otwierane przez ?wersja=).
export default function LegalVersions({ current, shown, versions, dataOd }) {
  const { pathname } = useLocation();
  const arch = versions.filter((v) => v.version !== current.version);
  return (
    <div className="mb-10 print:hidden">
      <p className="technical text-[10px] text-foreground/50 mb-3">
        Wersja {shown.version}{shown.date && ` z ${plDate(shown.date)}`}
        {dataOd && !shown.old && ` · Obowiązuje od: ${dataOd}`}
      </p>
      {shown.old && (
        <p className="text-sm bg-[#5C1A1B] border border-[#BC1E22] text-[#F5EFE1] px-4 py-3 mb-3">
          To archiwalna wersja dokumentu. <Link to={pathname} className="underline">Zobacz obecną wersję {current.version}</Link>.
        </p>
      )}
      <p className="technical text-[10px] text-foreground/40">
        Poprzednie wersje:{" "}
        {arch.length === 0 ? "brak — to pierwsza wersja" : arch.map((a, i) => (
          <span key={a.version}>{i > 0 && ", "}<Link to={`${pathname}?wersja=${a.version}`} className="gold-text underline">{a.version}{a.date && ` (${plDate(a.date)})`}</Link></span>
        ))}
      </p>
    </div>
  );
}