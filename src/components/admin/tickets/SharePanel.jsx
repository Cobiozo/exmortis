import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download, Share2 } from "lucide-react";
import { SITE_URL } from "@/config/site";

// Udostępnianie strony wydarzenia (zakup biletów / zapis): linki z podglądem do mediów społecznościowych,
// przyciski udostępniania i kod QR na plakat. Parametr src pokazuje w zapisach, skąd ktoś przyszedł.
export default function SharePanel({ event }) {
  const [msg, setMsg] = useState("");
  const [qr, setQr] = useState("");
  const page = `${SITE_URL}/spotkania/${event.slug}`;
  const share = (src) => `${SITE_URL}/functions/eventShare?slug=${encodeURIComponent(event.slug)}${src ? `&src=${src}` : ""}`;
  const text = `${event.title} — bilety na exmortis.pl`;

  useEffect(() => {
    QRCode.toDataURL(`${page}?src=plakat`, { errorCorrectionLevel: "M", margin: 2, width: 1200, color: { dark: "#0A0A0B", light: "#FFFFFF" } }).then(setQr).catch(() => {});
  }, [page]);

  const copy = async (v) => {
    try { await navigator.clipboard.writeText(v); setMsg(`Skopiowano: ${v}`); } catch { setMsg(v); }
  };
  const nets = [
    ["Facebook", `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(share("facebook"))}`],
    ["WhatsApp", `https://wa.me/?text=${encodeURIComponent(`${text} ${share("whatsapp")}`)}`],
    ["Messenger / SMS", `sms:?&body=${encodeURIComponent(`${text} ${share("sms")}`)}`],
    ["X", `https://twitter.com/intent/tweet?url=${encodeURIComponent(share("x"))}&text=${encodeURIComponent(event.title)}`],
    ["LinkedIn", `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(share("linkedin"))}`],
    ["E-mail", `mailto:?subject=${encodeURIComponent(event.title)}&body=${encodeURIComponent(`${text}\n${page}?src=email`)}`],
  ];
  const Row = ({ label, value, hint }) => (
    <div className="border hairline p-4">
      <p className="technical text-[10px] text-foreground/50 mb-2">{label}</p>
      <div className="flex gap-2 items-center">
        <code className="flex-1 min-w-0 text-sm break-all text-[#F5EFE1]">{value}</code>
        <button type="button" onClick={() => copy(value)} className="btn-ghost !px-3 !py-2 shrink-0" aria-label={`Kopiuj: ${label}`}><Copy className="h-4 w-4" /></button>
      </div>
      {hint && <p className="text-xs text-foreground/45 mt-2">{hint}</p>}
    </div>
  );

  return (
    <div className="space-y-8 max-w-3xl">
      {event.status !== "Opublikowane" && <p className="text-sm text-[#E8C547]">Wydarzenie nie jest opublikowane — po kliknięciu linku goście zobaczą „Nie znaleziono”. Opublikuj je przed udostępnieniem.</p>}
      <Row label="LINK DO MEDIÓW SPOŁECZNOŚCIOWYCH (Z OKŁADKĄ I OPISEM W PODGLĄDZIE)" value={share("social")} hint="Wklej w post, relację, opis wydarzenia na Facebooku albo w bio na Instagramie. Facebook i Messenger pokażą okładkę, tytuł i datę; kliknięcie prowadzi na stronę z biletami." />
      <Row label="ZWYKŁY LINK DO STRONY" value={page} />
      <div>
        <p className="technical text-[10px] text-foreground/50 mb-3">UDOSTĘPNIJ</p>
        <div className="flex flex-wrap gap-2">
          {typeof navigator !== "undefined" && navigator.share && (
            <button type="button" onClick={() => navigator.share({ title: event.title, text, url: share("udostepnij") }).catch(() => {})} className="btn-relic !px-4 !py-2.5"><Share2 className="h-4 w-4" /> UDOSTĘPNIJ…</button>
          )}
          {nets.map(([l, href]) => <a key={l} href={href} target="_blank" rel="noopener noreferrer" className="btn-ghost !px-4 !py-2.5">{l.toUpperCase()}</a>)}
        </div>
        <p className="text-xs text-foreground/45 mt-3">Instagram nie przyjmuje linków w postach — użyj linku powyżej w bio albo naklejki „Link” w relacji.</p>
      </div>
      <div className="border hairline p-4 flex flex-wrap gap-5 items-center">
        {qr && <img src={qr} alt={`Kod QR do strony ${event.title}`} className="w-36 h-36 bg-white" />}
        <div className="flex-1 min-w-[200px] space-y-3">
          <p className="technical text-[10px] text-foreground/50">KOD QR NA PLAKAT / ULOTKĘ</p>
          <p className="text-sm text-foreground/65">Prowadzi na stronę wydarzenia. Wydrukuj co najmniej 3×3 cm.</p>
          {qr && <a href={qr} download={`qr-${event.slug}.png`} className="btn-ghost !px-4 !py-2.5"><Download className="h-4 w-4" /> POBIERZ PNG</a>}
        </div>
      </div>
      {msg && <p className="technical text-[10px] gold-text break-all" role="status">{msg}</p>}
    </div>
  );
}
