import React, { useEffect, useRef, useState } from "react";
import { Share2, Link2, Check, X } from "lucide-react";
import { SITE_URL } from "@/config/site";

// „Udostępnij” odcinek (25.11.2026): na telefonie systemowe okno udostępniania (Instagram, Facebook,
// WhatsApp, Messenger, SMS…), na komputerze lista serwisów i kopiowanie linku.
// Link prowadzi do /glos/<slug> — serwer podaje tam tytuł, opis i okładkę odcinka dla podglądu linku.
export default function ShareButton({ ep, className = "", up = true }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const box = useRef(null);
  const base = `${SITE_URL}/glos/${ep.slug}`;
  const u = (src) => `${base}?src=${src}`;
  const text = `${ep.tytul} — Podcast exmortis`;

  useEffect(() => {
    if (!open) return undefined;
    const off = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", off);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", off); document.removeEventListener("keydown", esc); };
  }, [open]);

  const click = async () => {
    const touch = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
    if (touch && navigator.share) {
      try { await navigator.share({ title: text, text, url: u("udostepnij") }); return; }
      catch (e) { if (e?.name === "AbortError") return; }
    }
    setOpen((o) => !o);
  };
  const copy = () => {
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 2000); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(u("link")).then(done).catch(() => window.prompt("Skopiuj link do odcinka:", u("link")));
    else window.prompt("Skopiuj link do odcinka:", u("link"));
  };

  const item = "flex w-full items-center gap-3 rounded-[var(--exm-r-field)] px-3 py-2.5 text-left text-[14px] text-exm-ivory hover:bg-exm-surface-2";
  const links = [
    ["Facebook", `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u("facebook"))}`],
    ["WhatsApp", `https://wa.me/?text=${encodeURIComponent(`${text} ${u("whatsapp")}`)}`],
    ["X (Twitter)", `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(u("x"))}`],
    ["LinkedIn", `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u("linkedin"))}`],
    ["E-mail", `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(`${text}\n${u("email")}`)}`],
  ];

  return (
    <div ref={box} className={`relative inline-block ${className}`}>
      <button type="button" onClick={click} aria-haspopup="menu" aria-expanded={open}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--exm-r-field)] border border-exm-line px-4 text-[14px] text-exm-ivory transition-colors hover:border-exm-gold-line">
        <Share2 className="h-4 w-4" aria-hidden="true" /> Udostępnij
      </button>
      {open && (
        <div role="menu" aria-label="Udostępnij odcinek"
          className={`absolute left-0 z-40 w-64 max-w-[80vw] rounded-[var(--exm-r-card)] border border-exm-line bg-exm-bg p-2 shadow-[0_12px_40px_rgba(0,0,0,0.55)] ${up ? "bottom-full mb-2" : "top-full mt-2"}`}>
          <div className="flex items-center justify-between px-3 pb-2 pt-1">
            <span className="exm-eyebrow">Udostępnij odcinek</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Zamknij" className="text-exm-muted hover:text-exm-ivory"><X className="h-4 w-4" /></button>
          </div>
          <button type="button" role="menuitem" onClick={copy} className={item}>
            {copied ? <Check className="h-4 w-4 text-exm-gold" /> : <Link2 className="h-4 w-4 text-exm-muted" />}
            {copied ? "Link skopiowany" : "Kopiuj link"}
          </button>
          {links.map(([label, href]) => (
            <a key={label} role="menuitem" href={href} target="_blank" rel="noopener noreferrer" className={item} onClick={() => setOpen(false)}>
              <span className="inline-block h-4 w-4" aria-hidden="true" />{label}
            </a>
          ))}
          <p className="px-3 pb-1 pt-2 text-[12px] leading-snug text-exm-muted">Instagram i TikTok: skopiuj link i wklej go w opisie albo w relacji.</p>
        </div>
      )}
    </div>
  );
}
