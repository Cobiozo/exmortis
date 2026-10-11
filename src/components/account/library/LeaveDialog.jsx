import React from "react";
import { ExternalLink } from "lucide-react";

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A24A]";

// Wyjście na zewnątrz zawsze przez jedno okno z nazwą domeny — bez cichego przekierowania.
export default function LeaveDialog({ url, onClose }) {
  if (!url) return null;
  const host = (() => { try { return new URL(url).hostname; } catch { return url; } })();

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-6" role="dialog" aria-modal="true">
      <div className="w-full sm:max-w-[460px] bg-[#0A0A0B] border border-[rgba(201,162,74,.35)] p-6">
        <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-[#C9A24A]">Opuszczasz exmortis.pl</p>
        <p className="font-body text-[15px] leading-relaxed text-[#F5EFE1]/85 mt-4">
          Ten odnośnik prowadzi do serwisu zewnętrznego. Za treści i pliki cookies odpowiada jego właściciel.
        </p>
        <p className="font-mono text-[13px] text-[#F5EFE1] mt-4 break-all">{host}</p>
        <div className="flex flex-wrap gap-3 mt-7">
          <a href={url} target="_blank" rel="noopener noreferrer" onClick={onClose}
            className={`inline-flex items-center justify-center gap-2 min-h-[44px] px-5 bg-[#C9A24A] text-[#0A0A0B] font-mono text-xs tracking-[0.14em] uppercase hover:bg-[#E2C170] ${FOCUS}`}>
            <ExternalLink className="w-4 h-4" strokeWidth={1.5} /> OTWÓRZ {host}
          </a>
          <button type="button" onClick={onClose}
            className={`inline-flex items-center justify-center min-h-[44px] px-5 border hairline text-[#F5EFE1] font-mono text-xs tracking-[0.14em] uppercase hover:border-[#C9A24A] hover:text-[#C9A24A] ${FOCUS}`}>
            ZOSTAŃ
          </button>
        </div>
      </div>
    </div>
  );
}