import React, { useState } from "react";
import { Copy, Check } from "lucide-react";

// Skąd przychodzą zapisy: zestawienie źródeł (oznaczenie ?src= w linku albo rozpoznana strona, z której ktoś przyszedł)
// i obecność (wejście do pokoju przez osobisty link). Plus gotowe linki z oznaczeniem do wklejenia w kanałach.
const LABELS = {
  instagram: "Instagram", facebook: "Facebook", youtube: "YouTube", whatsapp: "WhatsApp", email: "E-mail / Listy",
  tiktok: "TikTok", google: "Google", x: "X (Twitter)", linkedin: "LinkedIn", podcast: "Podcast", bilet: "Zakup biletu",
  "": "Bezpośrednio / nieznane",
};
export function normSource(s) {
  const v = String(s || "").trim().toLowerCase();
  if (!v) return "";
  if (/^(ig|insta|instagram)/.test(v)) return "instagram";
  if (/^(fb|facebook|meta)/.test(v)) return "facebook";
  if (/^(yt|youtube)/.test(v)) return "youtube";
  if (/^(wa|whatsapp)/.test(v)) return "whatsapp";
  if (/^(mail|email|e-mail|newsletter|listy)/.test(v)) return "email";
  if (/^(tt|tiktok)/.test(v)) return "tiktok";
  if (/^(google|search)/.test(v)) return "google";
  if (/^(x|twitter|t\.co)$/.test(v)) return "x";
  if (/^linkedin/.test(v)) return "linkedin";
  if (/^podcast/.test(v)) return "podcast";
  return v;
}
const CHANNELS = [["instagram", "Instagram"], ["facebook", "Facebook"], ["youtube", "YouTube"], ["whatsapp", "WhatsApp"], ["email", "E-mail"]];

export default function SourcesReport({ event, parts }) {
  const [copied, setCopied] = useState("");
  const active = (parts || []).filter((p) => p.status !== "Wypisany");
  const rows = {};
  for (const p of active) {
    const k = normSource(p.source);
    rows[k] = rows[k] || { n: 0, joined: 0 };
    rows[k].n++;
    if (p.joined_at || p.status === "Obecny") rows[k].joined++;
  }
  const list = Object.entries(rows).sort((a, b) => b[1].n - a[1].n);
  const total = active.length;
  const joinedTotal = active.filter((p) => p.joined_at || p.status === "Obecny").length;
  const path = event.short_path ? `/${event.short_path}` : `/spotkania/${event.slug}`;
  const copy = async (url, k) => {
    try { await navigator.clipboard.writeText(url); setCopied(k); setTimeout(() => setCopied(""), 1500); } catch { /* brak schowka */ }
  };

  return (
    <div className="border hairline p-5 mb-6 space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <p className="technical text-[10px] gold-text">ŹRÓDŁA ZAPISÓW</p>
        {joinedTotal > 0 && <p className="technical text-[10px] text-foreground/50">WESZŁO DO POKOJU: <span className="gold-text">{joinedTotal}</span> z {total}</p>}
      </div>
      {total === 0 ? (
        <p className="text-sm text-foreground/50">Brak zapisów.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left technical text-[9px] text-foreground/45">
              <th className="py-1.5 font-normal">ŹRÓDŁO</th><th className="py-1.5 font-normal text-right">ZAPISY</th>
              <th className="py-1.5 font-normal text-right">UDZIAŁ</th><th className="py-1.5 font-normal text-right">WESZŁO</th>
            </tr>
          </thead>
          <tbody>
            {list.map(([k, v]) => (
              <tr key={k || "none"} className="border-t hairline">
                <td className="py-2">{LABELS[k] || k}</td>
                <td className="py-2 text-right text-[#F5EFE1]">{v.n}</td>
                <td className="py-2 text-right text-foreground/60">{Math.round((v.n / total) * 100)}%</td>
                <td className="py-2 text-right text-foreground/60">{v.joined || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div>
        <p className="technical text-[9px] text-foreground/45 mb-2">LINKI Z OZNACZENIEM — wklejaj w danym kanale, żeby raport wiedział, skąd jest zapis</p>
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map(([k, l]) => {
            const url = `https://exmortis.pl${path}?src=${k}`;
            return (
              <button key={k} onClick={() => copy(url, k)} className="btn-ghost !px-3 !py-1.5 text-[11px]" title={url}>
                {copied === k ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {l}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-foreground/40 mt-2">Bez oznaczenia źródło rozpoznaje się samo, gdy przeglądarka poda, z jakiej strony ktoś przyszedł (np. z Instagrama czy Facebooka). Aplikacje mobilne często tego nie podają — dlatego linki z oznaczeniem są pewniejsze.</p>
      </div>
    </div>
  );
}
