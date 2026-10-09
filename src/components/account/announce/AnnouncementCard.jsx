import React from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import RichLite from "./RichLite";
import { KIND_LABEL } from "./annApi";

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A24A]";
const BTN = `inline-flex items-center justify-center min-h-[44px] px-5 mt-4 border border-[#C9A24A] text-[#C9A24A] font-mono text-xs tracking-[0.14em] uppercase hover:bg-[#C9A24A] hover:text-[#0A0A0B] transition-colors ${FOCUS}`;

// Karta ogłoszenia w nagłówku Mojego konta.
export default function AnnouncementCard({ a, onDismiss, onClick }) {
  const ext = /^https:\/\//.test(a.przycisk_link || "");
  return (
    <article className={`relative bg-[#0A0A0B] p-4 sm:p-5 text-left ${a.wazne ? "border-2" : "border"} border-[rgba(201,162,74,.35)]`}>
      <p className="font-mono text-xs tracking-[0.18em] text-[#C9A24A] pr-10">{KIND_LABEL[a.rodzaj] || "OGŁOSZENIE"}</p>
      <h2 className="shop-heading text-[20px] leading-snug text-[#F5EFE1] mt-2 pr-8">{a.tytul}</h2>
      {a.tresc && <p className="font-body text-[15px] leading-relaxed text-[#F5EFE1]/85 mt-2"><RichLite text={a.tresc} /></p>}
      {a.przycisk_napis && a.przycisk_link && (ext
        ? <a href={a.przycisk_link} target="_blank" rel="noopener noreferrer" onClick={onClick} className={BTN}>{a.przycisk_napis}</a>
        : <Link to={a.przycisk_link} onClick={onClick} className={BTN}>{a.przycisk_napis}</Link>)}
      {a.zamykalne && (
        <button type="button" onClick={onDismiss} aria-label="Zamknij ogłoszenie"
          className={`absolute top-0 right-0 w-11 h-11 flex items-center justify-center text-[#F5EFE1]/60 hover:text-[#C9A24A] ${FOCUS}`}>
          <X className="w-5 h-5" strokeWidth={1.5} />
        </button>
      )}
    </article>
  );
}