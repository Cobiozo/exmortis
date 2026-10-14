import React, { useEffect, useState } from "react";
import { X, Download, ExternalLink, Check } from "lucide-react";
import { openMaterial, refreshLink, markCompleted, KIND, mmss } from "./libApi";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import AudioPlayer from "./AudioPlayer";
import VideoFacade from "./VideoFacade";
import VideoPlayer from "./VideoPlayer";
import LeaveDialog from "./LeaveDialog";

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A24A]";
const BTN = `inline-flex items-center justify-center gap-2 min-h-[44px] px-5 border border-[#C9A24A] text-[#C9A24A] font-mono text-xs tracking-[0.14em] uppercase hover:bg-[#C9A24A] hover:text-[#0A0A0B] transition-colors ${FOCUS}`;

// Okno materiału: audio, PDF, wideo, tekst albo link zewnętrzny. Otwarcie = „Nowe" znika.
export default function MaterialSheet({ material, completed, onClose, onOpened }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [leave, setLeave] = useState(false);
  const [done, setDone] = useState(!!completed);
  const id = material && material.id;

  useEffect(() => {
    if (!id) return;
    setD(null); setErr("");
    // Otwarty materiał przestaje być „Nowe" od razu, bez przeładowania strony.
    openMaterial(id)
      .then((r) => { setD(r); if (!material.opened_at && onOpened) onOpened(id); })
      .catch(() => setErr("Ten materiał nie jest już dostępny."));
  }, [id]);

  useEffect(() => {
    const esc = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  if (!material) return null;

  const renew = async () => {
    const r = await refreshLink(id).catch(() => null);
    return r && r.url ? r.url : null;
  };

  const toggleDone = async () => {
    const next = !done;
    setDone(next);
    await markCompleted(id, next).catch(() => setDone(!next));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 sm:p-6" role="dialog" aria-modal="true" aria-label={material.title}>
      <div className="w-full sm:max-w-[720px] max-h-[92vh] overflow-y-auto bg-[#0A0A0B] border border-[rgba(201,162,74,.35)]">
        <div className="sticky top-0 z-10 flex items-start gap-4 bg-[#0A0A0B] border-b hairline p-5">
          <div className="min-w-0">
            <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-[#C9A24A]">{KIND[material.kind] || material.kind}</p>
            <h2 className="shop-heading text-[22px] leading-snug text-[#F5EFE1] mt-1 break-words">{material.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Zamknij"
            className={`ml-auto shrink-0 w-11 h-11 flex items-center justify-center text-[#F5EFE1]/60 hover:text-[#C9A24A] ${FOCUS}`}>
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {!d && !err && <p className="text-foreground/55 font-body text-[15px]">Przygotowuję materiał…</p>}
          {err && <p className="font-body text-[15px] text-[#F5EFE1]/70">{err}</p>}

          {d && material.kind === "AUDIO" && (
            <div className="space-y-3">
              {d.url
                ? <AudioPlayer src={d.url} expiresIn={d.expires_in} onRefresh={renew} />
                : <p className="font-body text-[15px] text-[#F5EFE1]/70">Nagranie jest chwilowo niedostępne.</p>}
              {material.duration_s ? <p className="font-mono text-xs text-foreground/55">{mmss(material.duration_s)}</p> : null}
            </div>
          )}

          {d && material.kind === "PDF" && (
            <div className="flex flex-wrap gap-3">
              <a href={d.url} target="_blank" rel="noopener noreferrer" className={BTN}>
                <ExternalLink className="w-4 h-4" strokeWidth={1.5} /> OTWÓRZ PDF
              </a>
              {d.allow_download && (
                <a href={d.url} download className={`${BTN} border-foreground/40 text-[#F5EFE1] hover:bg-[#C9A24A] hover:text-[#0A0A0B] hover:border-[#C9A24A]`}>
                  <Download className="w-4 h-4" strokeWidth={1.5} /> POBIERZ
                </a>
              )}
              {!d.url && <p className="font-body text-[15px] text-[#F5EFE1]/70">Plik jest chwilowo niedostępny.</p>}
            </div>
          )}

          {d && material.kind === "WIDEO" && (d.file || d.server
            ? (d.url
                ? <VideoPlayer src={d.url} expiresIn={d.expires_in} onRefresh={renew} allowDownload={d.allow_download} title={material.title} />
                : <p className="font-body text-[15px] text-[#F5EFE1]/70">Film jest chwilowo niedostępny.</p>)
            : <VideoFacade embed={d.embed} title={material.title} />)}

          {d && material.kind === "TEKST" && (
            <div className="rich-content font-body text-[15px] leading-relaxed text-[#F5EFE1]/85"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(d.text || "") }} />
          )}

          {d && material.kind === "LINK" && (
            d.external
              ? <button type="button" onClick={() => setLeave(true)} className={BTN}>
                  <ExternalLink className="w-4 h-4" strokeWidth={1.5} /> OTWÓRZ ODNOSNIK
                </button>
              : <p className="font-body text-[15px] text-[#F5EFE1]/70">Odnośnik jest chwilowo niedostępny.</p>
          )}

          {material.note && (
            <div className="border-l-2 border-[#C9A24A] pl-4">
              <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-[#C9A24A]">Notatka ode mnie</p>
              <p className="font-body text-[15px] leading-relaxed text-[#F5EFE1]/85 mt-2 whitespace-pre-line">{material.note}</p>
            </div>
          )}

          <button type="button" onClick={toggleDone}
            className={`inline-flex items-center gap-2 min-h-[44px] px-5 border font-mono text-xs tracking-[0.14em] uppercase transition-colors ${done ? "border-[#C9A24A] bg-[#C9A24A] text-[#0A0A0B]" : "hairline text-foreground/60 hover:text-[#C9A24A] hover:border-[#C9A24A]"} ${FOCUS}`}>
            <Check className="w-4 h-4" strokeWidth={1.5} /> {done ? "UKOŃCZONE" : "OZNACZ JAKO UKOŃCZONE"}
          </button>
        </div>
      </div>
      {leave && <LeaveDialog url={d && d.external} onClose={() => setLeave(false)} />}
    </div>
  );
}