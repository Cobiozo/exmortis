import React, { useState } from "react";
import { FileText, Headphones, Film, Layers, Download, BookOpen, Loader2, Play } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import CoverStage from "@/components/exmortis/shop/CoverStage";
import AccessLine from "./AccessLine";
import { TYPE_LABEL } from "./accountUtils";

const ICONS = { pdf: FileText, audio: Headphones, wideo: Film, kurs: Layers, zestaw: Layers };
const ico = "h-4 w-4";

// Kafelek w „Moich produktach”.
export default function ProductTile({ p }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [audio, setAudio] = useState(null);
  const Icon = ICONS[p.type] || FileText;

  const getUrl = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await base44.functions.invoke("myAccount", { action: "file", access_id: p.access_id });
      return r.data;
    } catch {
      setErr("Plik nie chce się wczytać. Spróbuj jeszcze raz za chwilę.");
      return null;
    } finally {
      setBusy(false);
    }
  };
  // Pobierz — plik zapisuje się na urządzeniu; Czytaj — otwiera się w nowej karcie.
  const download = async () => {
    const d = await getUrl();
    if (!d) return;
    const a = document.createElement("a");
    a.href = d.download_url || d.url; a.download = d.name || "plik"; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
  };
  const open = async () => { const d = await getUrl(); if (d?.url) window.open(d.url, "_blank", "noopener,noreferrer"); };

  return (
    <div className={`rounded-2xl border hairline bg-[#111113] overflow-hidden flex flex-col hover:border-[#C9A24A]/45 transition-colors ${p.active ? "" : "opacity-50"}`}>
      <div className="aspect-[16/9] sm:aspect-[4/3] bg-[#0F0F10] relative">
        {p.cover ? <CoverStage src={p.cover} alt={p.name} /> : (
          <div className="absolute inset-0 flex items-center justify-center"><Icon className="h-10 w-10 gold-text" strokeWidth={1} /></div>
        )}
      </div>
      <div className="p-5 flex flex-col gap-3 flex-1">
        <p className="flex items-center gap-2 technical text-[9px] gold-text"><Icon className="h-3.5 w-3.5" strokeWidth={1.25} /> {TYPE_LABEL[p.type]}</p>
        <h3 className="shop-heading text-xl text-[#F5EFE1] leading-tight">{p.name}</h3>
        <AccessLine p={p} />
        {p.active && p.lessons_total > 0 && (
          <div>
            <div className="flex justify-between technical text-[9px] text-foreground/55"><span>{p.lessons_done >= p.lessons_total ? "UKOŃCZONY" : `LEKCJE ${p.lessons_done} / ${p.lessons_total}`}</span><span>{Math.round((p.lessons_done / p.lessons_total) * 100)}%</span></div>
            <div className="mt-1.5 h-1 bg-[#26262A]" aria-hidden="true"><div className="h-full bg-[#C9A24A]" style={{ width: `${Math.round((p.lessons_done / p.lessons_total) * 100)}%` }} /></div>
          </div>
        )}
        <div className="mt-auto pt-3 space-y-3">
          {!p.active ? null : !p.has_file && (p.type === "pdf" || p.type === "audio") ? (
            <p className="text-xs text-foreground/55">Materiał jest w przygotowaniu. Poinformuję Cię e-mailem, gdy będzie dostępny.</p>
          ) : p.type === "zestaw" ? (
            // Ebook do pobrania + nagrania tylko do odtwarzania w odtwarzaczu konta.
            <div className="flex flex-wrap gap-3">
              <Link to={`/konto/kurs/${p.access_id}`} className="btn-relic !px-4 !py-2.5"><Play className={ico} strokeWidth={1.25} /> {p.lessons_done > 0 && p.lessons_done < p.lessons_total ? "Kontynuuj nagrania" : "Słuchaj i oglądaj"}</Link>
              {p.has_file && <button onClick={download} disabled={busy} className="btn-ghost !px-4 !py-2.5">{busy ? <Loader2 className={`${ico} animate-spin`} /> : <Download className={ico} strokeWidth={1.25} />} Pobierz ebook</button>}
              {p.has_file && <button onClick={open} disabled={busy} className="btn-link">Czytaj w przeglądarce</button>}
            </div>
          ) : p.type === "pdf" ? (
            <div className="flex flex-wrap gap-3">
              <button onClick={download} disabled={busy} className="btn-relic !px-4 !py-2.5">{busy ? <Loader2 className={`${ico} animate-spin`} /> : <Download className={ico} strokeWidth={1.25} />} Pobierz</button>
              <button onClick={open} disabled={busy} className="btn-ghost !px-4 !py-2.5"><BookOpen className={ico} strokeWidth={1.25} /> Czytaj w przeglądarce</button>
            </div>
          ) : p.type === "audio" ? (
            audio ? <audio src={audio} controls autoPlay controlsList="nodownload" className="w-full" /> : (
              <button onClick={async () => setAudio((await getUrl())?.url)} disabled={busy} className="btn-relic !px-4 !py-2.5">{busy ? <Loader2 className={`${ico} animate-spin`} /> : <Play className={ico} strokeWidth={1.25} />} SŁUCHAJ</button>
            )
          ) : (
            <Link to={`/konto/kurs/${p.access_id}`} className="btn-relic !px-4 !py-2.5"><Play className={ico} strokeWidth={1.25} /> {p.lessons_done > 0 && p.lessons_done < p.lessons_total ? "Kontynuuj" : p.type === "kurs" ? "Otwórz kurs" : "Oglądaj"}</Link>
          )}
          {err && <p className="text-xs text-[#E8C547]">{err}</p>}
        </div>
      </div>
    </div>
  );
}