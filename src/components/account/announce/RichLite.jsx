import React from "react";

// Tylko **pogrubienie** i [tekst](adres). Wszystko inne to zwykły tekst — bez HTML.
const RE = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(((?:\/|https:\/\/)[^\s)]+)\)/g;

export default function RichLite({ text }) {
  const out = [];
  let last = 0, m, i = 0;
  const s = String(text || "");
  while ((m = RE.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    if (m[1]) out.push(<strong key={i++} className="font-semibold text-[#F5EFE1]">{m[1]}</strong>);
    else {
      const ext = m[3].startsWith("http");
      out.push(<a key={i++} href={m[3]} {...(ext ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="underline decoration-[#C9A24A] underline-offset-4 hover:text-[#C9A24A]">{m[2]}</a>);
    }
    last = RE.lastIndex;
  }
  if (last < s.length) out.push(s.slice(last));
  return <>{out}</>;
}