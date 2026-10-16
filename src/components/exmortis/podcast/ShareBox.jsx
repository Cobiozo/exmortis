import React, { useState } from "react";
import { usePodcastPlayer } from "./PlayerContext";
import { fmtT } from "./podcastUtils";
import { SITE_URL } from "@/config/site";

export default function ShareBox({ ep }) {
  const p = usePodcastPlayer();
  const [copied, setCopied] = useState("");
  const base = `${SITE_URL}/glos/${ep.slug}`;
  const u = (src) => `${base}?src=${src}`;
  const copy = (txt, label) => navigator.clipboard.writeText(txt).then(() => { setCopied(label); setTimeout(() => setCopied(""), 2000); });
  const at = p.ep?.id === ep.id ? Math.floor(p.t) : 0;
  const cls = "btn-ghost !px-4 !py-2 text-[10px]";
  // Link aplikacji Messenger działa tylko na telefonie — na komputerze kopiuję link do schowka.
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
  return (
    <div className="space-y-3">
      <p className="technical text-[10px] text-foreground/55">UDOSTĘPNIJ</p>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => copy(u("link"), "link")} className={cls}>{copied === "link" ? "SKOPIOWANO" : "KOPIUJ LINK"}</button>
        <a className={cls} target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`${ep.tytul} ${u("whatsapp")}`)}`}>WHATSAPP</a>
        <a className={cls} target="_blank" rel="noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u("fb-profil"))}`}>FACEBOOK</a>
        {isMobile
          ? <a className={cls} href={`fb-messenger://share/?link=${encodeURIComponent(u("messenger"))}`}>MESSENGER</a>
          : <button onClick={() => copy(u("messenger"), "msgr")} className={cls}>{copied === "msgr" ? "SKOPIOWANO" : "MESSENGER"}</button>}
        {at > 0 && <button onClick={() => copy(`${base}?t=${fmtT(at)}`, "t")} className={cls}>{copied === "t" ? "SKOPIOWANO" : `OD MOMENTU ${fmtT(at)}`}</button>}
      </div>
    </div>
  );
}