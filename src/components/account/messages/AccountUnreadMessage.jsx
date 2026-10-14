import React, { useEffect, useState } from "react";
import { unreadMessage, readMessage, hideMessage, plainText, plDateTime } from "@/components/account/library/libApi";

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A24A]";
const BTN = `inline-flex items-center justify-center min-h-[44px] px-5 font-mono text-xs tracking-[0.14em] uppercase transition-colors ${FOCUS}`;

// Najnowsza nieprzeczytana wiadomość w nagłówku konta — nad ogłoszeniami.
export default function AccountUnreadMessage({ initial, onOpen }) {
  const [m, setM] = useState(initial || null);
  const [gone, setGone] = useState(false);

  // Dane z wejścia na /konto są już wczytane — osobne zapytanie tylko, gdy ich nie ma.
  useEffect(() => { if (initial) return; unreadMessage().then((d) => setM(d.latest || null)).catch(() => {}); }, [initial]);

  if (!m || gone) return null;
  const preview = plainText(m.text).slice(0, 180);

  const read = async () => {
    setGone(true);
    await readMessage(m.id).catch(() => {});
    onOpen();
  };
  const hide = async () => {
    setGone(true);
    await hideMessage(m.id).catch(() => {});
  };

  return (
    <article className="relative bg-[#0A0A0B] p-5 border border-[rgba(201,162,74,.5)]" aria-label="Nowa wiadomość">
      <p className="font-mono text-xs tracking-[0.18em] text-[#C9A24A]">NOWA WIADOMOŚĆ</p>
      {m.title && <h2 className="shop-heading text-[20px] leading-snug text-[#F5EFE1] mt-2 break-words">{m.title}</h2>}
      {preview && <p className="font-body text-[15px] leading-relaxed text-[#F5EFE1]/85 mt-2">{preview}{preview.length >= 180 ? "…" : ""}</p>}
      {m.sent_at && <p className="font-mono text-[11px] text-foreground/55 mt-3">{plDateTime(m.sent_at)}</p>}
      <div className="flex flex-wrap gap-3 mt-5">
        <button type="button" onClick={read}
          className={`${BTN} bg-[#C9A24A] text-[#0A0A0B] hover:bg-[#E2C170]`}>CZYTAJ</button>
        <button type="button" onClick={hide}
          className={`${BTN} border hairline text-foreground/60 hover:text-[#F5EFE1]`}>UKRYJ</button>
      </div>
    </article>
  );
}